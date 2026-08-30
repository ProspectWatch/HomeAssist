import type { MatchQuality, ProductCandidate, ProductMatch, ProductNeed } from "./types";

function norm(s: string | null): string | null {
  return s ? s.trim().toLowerCase() : null;
}

function brandMatches(a: string | null, b: string | null): boolean {
  const na = norm(a);
  const nb = norm(b);
  return na !== null && nb !== null && na === nb;
}

function variantMatches(a: string | null, b: string | null): boolean {
  if (!a || !b) return true; // no variant preference to violate
  return norm(a) === norm(b);
}

/**
 * Resolves how well one retailer candidate satisfies a household's need,
 * per the brand_rigidity the household set for this product/subcategory/
 * category (see household_product_preferences). No preference at all is
 * treated as FLEXIBLE — any reasonable candidate is an acceptable match.
 */
export function matchCandidate(need: ProductNeed, candidate: ProductCandidate): ProductMatch {
  const pref = need.preference;
  let matchQuality: MatchQuality;
  let matchReason: string;

  if (!pref) {
    if (need.catalogueProductId && candidate.catalogueProductId === need.catalogueProductId) {
      matchQuality = "EXACT";
      matchReason = "No household preference set — matches the requested catalogue product.";
    } else {
      matchQuality = "ACCEPTABLE";
      matchReason = "No household preference set for this product.";
    }
  } else {
    const brandOk = brandMatches(pref.preferredBrand, candidate.brand);
    const variantOk = variantMatches(pref.preferredVariant, candidate.variant);
    const acceptableBrand =
      candidate.brand !== null &&
      pref.acceptableBrands.some((b) => norm(b) === norm(candidate.brand));

    if (pref.brandRigidity === "EXACT_ONLY") {
      if (pref.preferredBrand === null) {
        matchQuality = "VERY_CLOSE";
        matchReason = "Household requires an exact match, but no specific brand is set.";
      } else if (brandOk && variantOk) {
        matchQuality = "EXACT";
        matchReason = `Matches the required brand${pref.preferredVariant ? " and variant" : ""} exactly.`;
      } else if (brandOk) {
        matchQuality = "VERY_CLOSE";
        matchReason = "Matches the required brand, but not the exact variant.";
      } else {
        matchQuality = "LAST_RESORT";
        matchReason = `Household requires ${pref.preferredBrand} specifically — this isn't that brand.`;
      }
    } else {
      // PREFERRED or FLEXIBLE: brand match is best, an acceptable-brands
      // entry is still very close, and anything else degrades gracefully
      // rather than being excluded outright.
      if (brandOk && variantOk) {
        matchQuality = "EXACT";
        matchReason = pref.preferredBrand
          ? `Matches the preferred brand${pref.preferredVariant ? " and variant" : ""}.`
          : "Matches the household's preference.";
      } else if (brandOk) {
        matchQuality = "VERY_CLOSE";
        matchReason = "Matches the preferred brand, different variant.";
      } else if (acceptableBrand) {
        matchQuality = "VERY_CLOSE";
        matchReason = "Matches one of the household's acceptable brands.";
      } else if (pref.brandRigidity === "FLEXIBLE") {
        matchQuality = "ACCEPTABLE";
        matchReason = "Flexible brand preference — any reasonable match works.";
      } else {
        matchQuality = "ACCEPTABLE";
        matchReason = "Preferred brand not available here; closest generic match.";
      }
    }
  }

  return { need, candidate, matchQuality, matchReason };
}

const QUALITY_RANK: Record<MatchQuality, number> = {
  EXACT: 3,
  VERY_CLOSE: 2,
  ACCEPTABLE: 1,
  LAST_RESORT: 0,
};

/** Ranks candidates for a need, best match quality first, then lowest price. */
export function rankCandidates(need: ProductNeed, candidates: ProductCandidate[]): ProductMatch[] {
  return candidates
    .map((c) => matchCandidate(need, c))
    .sort((a, b) => {
      const qDiff = QUALITY_RANK[b.matchQuality] - QUALITY_RANK[a.matchQuality];
      if (qDiff !== 0) return qDiff;
      return a.candidate.priceCents - b.candidate.priceCents;
    });
}
