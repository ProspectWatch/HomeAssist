/**
 * The canonical path for adding a household need to the grocery list.
 *
 * Every route into the list — tapping OUT during a Pantry Check, adding from
 * a recipe, typing it manually, and (later) saying "we're out of eggs" to a
 * speaker — goes through addHouseholdNeed so that product matching and
 * duplicate protection can never be bypassed by a new caller.
 */

/** Where a need came from. VOICE is reserved for a future Alexa integration
 *  (not implemented in this phase) and exists now precisely so that path will
 *  be forced through this same service rather than around it. */
export type NeedSource = "MANUAL" | "PANTRY" | "RECIPE" | "VOICE" | "RECEIPT" | "AUTOMATION";

export const NEED_SOURCES: NeedSource[] = [
  "MANUAL",
  "PANTRY",
  "RECIPE",
  "VOICE",
  "RECEIPT",
  "AUTOMATION",
];

/** The subset of a grocery row duplicate matching needs to reason about. */
export type ActiveListItem = {
  id: string;
  name: string;
  catalogProductId: string | null;
};

export type HouseholdNeed = {
  /** Catalogue identity — the strong signal duplicate matching is built on. */
  catalogProductId: string | null;
  /**
   * What the household calls it. For a catalogue-backed need this should be
   * the household's own label ("Eggs"), not a brand-specific SKU name —
   * Shopping Intelligence resolves the actual product to buy later.
   */
  name: string;
  quantity?: string | null;
  note?: string | null;
  source: NeedSource;
};

export type NeedMatch =
  | { kind: "existing"; itemId: string; reason: string }
  | { kind: "create"; reason: string };

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Decides whether a need is already on the active list or needs a new row.
 *
 * Matching is deliberately conservative and anchored on catalogue identity:
 * two rows are the same need when they point at the same catalogue product,
 * or when neither has been given a different catalogue identity and their
 * names are exactly equal after whitespace/case normalization. There is no
 * fuzzy or partial matching — "Eggs" will never absorb a manual "egg noodles"
 * row, and two unrelated custom items are never merged just because their
 * names look similar.
 *
 * Pure and dependency-free so the rule can be tested directly.
 */
export function resolveNeedMatch(activeItems: ActiveListItem[], need: HouseholdNeed): NeedMatch {
  if (need.catalogProductId) {
    const sameProduct = activeItems.find((item) => item.catalogProductId === need.catalogProductId);
    if (sameProduct) {
      return {
        kind: "existing",
        itemId: sameProduct.id,
        reason: "Already on the list as the same catalogue product.",
      };
    }
    // A row added before catalogue linking existed (or typed by hand) still
    // represents this need when the names match exactly.
    const sameNameUnlinked = activeItems.find(
      (item) => item.catalogProductId === null && normalizeName(item.name) === normalizeName(need.name),
    );
    if (sameNameUnlinked) {
      return {
        kind: "existing",
        itemId: sameNameUnlinked.id,
        reason: "Already on the list under the same name.",
      };
    }
    return { kind: "create", reason: "Not on the list yet." };
  }

  // A custom, name-only need may only match another name-only row. It must
  // never silently attach itself to a catalogue-backed item.
  const sameCustom = activeItems.find(
    (item) => item.catalogProductId === null && normalizeName(item.name) === normalizeName(need.name),
  );
  if (sameCustom) {
    return {
      kind: "existing",
      itemId: sameCustom.id,
      reason: "Already on the list under the same name.",
    };
  }
  return { kind: "create", reason: "Not on the list yet." };
}
