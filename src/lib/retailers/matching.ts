import {
  normalizeName,
  packageSizesComparable,
  parsePackageSize,
  tokenize,
} from "./normalization";
import type { CatalogMatch, MatchMethod, RetailerProductRaw } from "./types";

/** The catalogue fields matching needs. Deliberately a narrow shape so this
 *  stays testable without a database. */
export type MatchableCatalogProduct = {
  id: string;
  display_name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  search_aliases: string[];
  default_unit: string | null;
};

/**
 * Confidence thresholds. These live here — never in an adapter — so every
 * retailer is held to the same evidentiary bar.
 *
 * The gap between AUTO and REVIEW is the important one: a product that is
 * merely plausible is queued for review rather than silently mapped to the
 * wrong catalogue concept, because a bad mapping quietly corrupts price
 * history and every downstream recommendation.
 */
export const MATCH_THRESHOLDS = {
  /** At/above: safe to map automatically. */
  auto: 0.85,
  /** At/above: probably right, flagged as LIKELY_MATCH but still usable. */
  likely: 0.7,
  /** At/above: a human should confirm before it is trusted. */
  review: 0.45,
} as const;

function statusFor(confidence: number): CatalogMatch["status"] {
  if (confidence >= MATCH_THRESHOLDS.auto) return "MATCHED";
  if (confidence >= MATCH_THRESHOLDS.likely) return "LIKELY_MATCH";
  if (confidence >= MATCH_THRESHOLDS.review) return "REVIEW_REQUIRED";
  return "UNMATCHED";
}

function brandsAgree(rawBrand: string | null, catalogBrand: string | null): boolean | null {
  if (!rawBrand || !catalogBrand) return null; // no evidence either way
  return normalizeName(rawBrand) === normalizeName(catalogBrand);
}

/** Jaccard overlap of meaningful tokens. */
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / new Set([...ta, ...tb]).size;
}

/** True when every meaningful catalogue token appears in the retailer name. */
function catalogTokensCovered(retailerName: string, catalogName: string): boolean {
  const haystack = new Set(tokenize(retailerName));
  const needles = tokenize(catalogName);
  return needles.length > 0 && needles.every((t) => haystack.has(t));
}

export type ScoredMatch = { product: MatchableCatalogProduct; confidence: number; method: MatchMethod };

/** Scores one candidate catalogue product against a retailer product. */
function score(raw: RetailerProductRaw, candidate: MatchableCatalogProduct): ScoredMatch {
  const rawName = raw.name;
  const normalizedRaw = normalizeName(rawName);

  // An alias hit is strong evidence: aliases are hand-curated household
  // vocabulary ("ny strip", "chicken fingers").
  const aliasHit = candidate.search_aliases.some((alias) => {
    const a = normalizeName(alias);
    return a.length > 2 && normalizedRaw.includes(a);
  });

  const nameCovered = catalogTokensCovered(rawName, candidate.display_name);
  const overlap = tokenOverlap(rawName, candidate.display_name);
  const brandAgreement = brandsAgree(raw.brand ?? null, candidate.brand);

  let confidence = 0;
  let method: MatchMethod = "none";

  if (normalizedRaw === normalizeName(candidate.display_name)) {
    confidence = 0.95;
    method = "normalized_name";
  } else if (nameCovered) {
    // The catalogue concept is fully present in the retailer's name — e.g.
    // "PC Boneless Skinless Chicken Breast" contains "Chicken Breast".
    confidence = 0.8;
    method = "brand_and_name";
  } else if (aliasHit) {
    confidence = 0.72;
    method = "alias";
  } else {
    confidence = overlap * 0.8;
    method = "token_overlap";
  }

  // Brand evidence adjusts, it does not decide. A generic catalogue concept
  // has no brand, so absence is neutral rather than penalised.
  if (brandAgreement === true) confidence = Math.min(1, confidence + 0.1);
  else if (brandAgreement === false) confidence = Math.max(0, confidence - 0.25);

  // Package size is corroboration when both sides state one.
  const rawSize = parsePackageSize(raw.packageSize ?? null);
  const catalogSize = parsePackageSize(candidate.default_unit);
  if (rawSize.quantity !== null && catalogSize.quantity !== null) {
    if (packageSizesComparable(rawSize, catalogSize)) confidence = Math.min(1, confidence + 0.05);
    else confidence = Math.max(0, confidence - 0.1);
  }

  return { product: candidate, confidence: Number(confidence.toFixed(3)), method };
}

/**
 * Matches a retailer product to the HomeAssist catalogue.
 *
 * Never exact-name-only: name coverage, curated aliases, brand agreement,
 * package size and token overlap all contribute. Crucially, when the two best
 * candidates are close together the result is demoted to REVIEW_REQUIRED —
 * an ambiguous product must not silently pick a winner.
 */
export function matchToCatalog(
  raw: RetailerProductRaw,
  catalog: MatchableCatalogProduct[],
): CatalogMatch {
  if (catalog.length === 0) {
    return {
      catalogProductId: null,
      confidence: 0,
      matchMethod: "none",
      status: "UNMATCHED",
      reason: "No catalogue products available to match against.",
    };
  }

  const scored = catalog.map((c) => score(raw, c)).sort((a, b) => b.confidence - a.confidence);
  const best = scored[0];
  const runnerUp = scored[1];

  if (best.confidence < MATCH_THRESHOLDS.review) {
    return {
      catalogProductId: null,
      confidence: best.confidence,
      matchMethod: best.method,
      status: "UNMATCHED",
      reason: `No catalogue product resembles "${raw.name}" closely enough.`,
    };
  }

  // Ambiguity guard: two plausible candidates within 0.06 is not a match, it
  // is a question. Better a review queue entry than a wrong price history.
  if (runnerUp && best.confidence - runnerUp.confidence < 0.06 && best.confidence < 0.95) {
    return {
      catalogProductId: null,
      confidence: best.confidence,
      matchMethod: best.method,
      status: "REVIEW_REQUIRED",
      reason: `Ambiguous: "${raw.name}" scores similarly against ${best.product.display_name} and ${runnerUp.product.display_name}.`,
    };
  }

  const status = statusFor(best.confidence);
  return {
    catalogProductId: status === "UNMATCHED" ? null : best.product.id,
    confidence: best.confidence,
    matchMethod: best.method,
    status,
    reason:
      status === "MATCHED"
        ? `Matched to ${best.product.display_name} via ${best.method}.`
        : `Probable match to ${best.product.display_name} via ${best.method}; confirm before trusting.`,
  };
}
