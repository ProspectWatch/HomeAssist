import { normalizeName, tokenize } from "@/lib/retailers/normalization";
import { matchToCatalog, type MatchableCatalogProduct } from "@/lib/retailers/matching";
import type { ReceiptMatchStatus } from "./types";

/**
 * Matching abbreviated receipt text to the catalogue.
 *
 * Receipt descriptions are heavily abbreviated ("CNSTGA BRN FR RNG EGGS"), so
 * this layers three signals on top of the Phase 3A catalogue matcher:
 *   1. a learned, retailer-scoped alias the household already confirmed
 *   2. abbreviation-aware token matching (prefix matching for truncated words)
 *   3. a bias toward products this household actually buys
 * Anything short of high confidence goes to review — a wrong mapping here
 * writes a wrong price into household history.
 */

/** A previously confirmed mapping for one retailer. */
export type LearnedAlias = {
  rawDescription: string;
  catalogProductId: string;
};

export type ReceiptMatchResult = {
  catalogProductId: string | null;
  confidence: number;
  matchMethod: string;
  status: ReceiptMatchStatus;
  reason: string;
};

/** Lookup key for a learned alias: normalized, whitespace-collapsed text. */
export function aliasKey(rawDescription: string): string {
  return normalizeName(rawDescription);
}

/**
 * True when `abbrev` reads like a truncation of `full`.
 * "cnstga" -> "conestoga": every letter of the abbreviation appears in order
 * in the full word, and it starts with the same letter.
 */
function isAbbreviationOf(abbrev: string, full: string): boolean {
  if (abbrev.length < 3 || abbrev.length > full.length) return false;
  if (abbrev[0] !== full[0]) return false;
  let i = 0;
  for (const ch of full) {
    if (ch === abbrev[i]) i++;
    if (i === abbrev.length) return true;
  }
  return false;
}

/** Fraction of catalogue tokens that the receipt text plausibly covers. */
function abbreviationCoverage(rawDescription: string, candidateName: string): number {
  const rawTokens = tokenize(rawDescription);
  const nameTokens = tokenize(candidateName);
  if (nameTokens.length === 0 || rawTokens.length === 0) return 0;

  let covered = 0;
  for (const nameToken of nameTokens) {
    const hit = rawTokens.some(
      (rawToken) => rawToken === nameToken || isAbbreviationOf(rawToken, nameToken),
    );
    if (hit) covered++;
  }
  return covered / nameTokens.length;
}

export const RECEIPT_MATCH_THRESHOLDS = {
  /** At/above: safe to auto-map without asking. */
  auto: 0.86,
  /** At/above: proposed, but flagged for a glance. */
  likely: 0.65,
} as const;

/**
 * Matches one receipt line.
 *
 * `householdProductIds` are the catalogue products this household actually
 * buys; a candidate the household never buys needs stronger evidence, which
 * keeps "MILK" from mapping to an obscure catalogue entry over the one on
 * their regular-buy list.
 */
export function matchReceiptLine(
  rawDescription: string,
  catalog: MatchableCatalogProduct[],
  options: {
    aliases?: LearnedAlias[];
    householdProductIds?: Set<string>;
  } = {},
): ReceiptMatchResult {
  const key = aliasKey(rawDescription);

  // 1. A mapping the household already confirmed for this retailer wins
  //    outright — it is the strongest evidence available (§8).
  const alias = options.aliases?.find((a) => a.rawDescription === key);
  if (alias) {
    return {
      catalogProductId: alias.catalogProductId,
      confidence: 1,
      matchMethod: "confirmed_alias",
      status: "MATCHED",
      reason: "You've mapped this receipt text before at this store.",
    };
  }

  // 2. Abbreviation-aware scoring across the catalogue.
  const household = options.householdProductIds ?? new Set<string>();
  const scored = catalog
    .map((product) => {
      const coverage = abbreviationCoverage(rawDescription, product.display_name);
      const aliasHit = product.search_aliases.some((a) => {
        const cov = abbreviationCoverage(rawDescription, a);
        return cov >= 0.999;
      });
      let confidence = aliasHit ? Math.max(coverage, 0.8) : coverage;
      // Evidence, not a decision: nudges toward what this household buys.
      if (household.has(product.id)) confidence = Math.min(1, confidence + 0.08);
      return { product, confidence: Number(confidence.toFixed(3)) };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const best = scored[0];
  const runnerUp = scored[1];

  // 3. Fall back to the shared Phase 3A matcher, which handles full (rather
  //    than abbreviated) descriptions well.
  if (!best || best.confidence < 0.5) {
    const generic = matchToCatalog(
      {
        retailerId: "",
        retailerLocationId: null,
        externalProductId: "",
        url: null,
        name: rawDescription,
        brand: null,
        observedAt: new Date().toISOString(),
      },
      catalog,
    );
    return {
      catalogProductId: generic.status === "UNMATCHED" ? null : generic.catalogProductId,
      confidence: generic.confidence,
      matchMethod: generic.matchMethod,
      status: generic.status === "MATCHED" ? "LIKELY_MATCH" : generic.status,
      reason: generic.reason,
    };
  }

  // Ambiguity guard: two similar candidates is a question, not an answer.
  if (runnerUp && best.confidence - runnerUp.confidence < 0.08) {
    return {
      catalogProductId: null,
      confidence: best.confidence,
      matchMethod: "abbreviation",
      status: "REVIEW_REQUIRED",
      reason: `"${rawDescription}" could be ${best.product.display_name} or ${runnerUp.product.display_name}.`,
    };
  }

  if (best.confidence >= RECEIPT_MATCH_THRESHOLDS.auto) {
    return {
      catalogProductId: best.product.id,
      confidence: best.confidence,
      matchMethod: "abbreviation",
      status: "MATCHED",
      reason: `Reads as ${best.product.display_name}.`,
    };
  }
  if (best.confidence >= RECEIPT_MATCH_THRESHOLDS.likely) {
    return {
      catalogProductId: best.product.id,
      confidence: best.confidence,
      matchMethod: "abbreviation",
      status: "LIKELY_MATCH",
      reason: `Probably ${best.product.display_name} — worth a glance.`,
    };
  }

  return {
    catalogProductId: null,
    confidence: best.confidence,
    matchMethod: "abbreviation",
    status: "UNMATCHED",
    reason: `Couldn't tell what "${rawDescription}" is.`,
  };
}

/** Lines that aren't products never get matched to one. */
export function isProductLine(lineType: string): boolean {
  return lineType === "ITEM" || lineType === "UNKNOWN";
}
