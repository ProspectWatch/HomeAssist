/**
 * Working out where the things on the list can be bought, and for how much.
 *
 * A word about the name. This is not a live stock check: no shop the household
 * uses publishes "we have three left on the shelf", and pretending otherwise
 * would send someone across town on a promise the app cannot make. What it can
 * do honestly is say where each item has been seen, at what price, and how
 * long ago — and, for Marilu's specifically, whether the shop lists the product
 * at all, because an Instacart product page really does distinguish "not
 * carried here" from "carried".
 *
 * So every line carries its evidence and its age, and an item nobody has ever
 * priced says exactly that rather than being quietly dropped.
 */

export type StoreSighting = {
  retailerId: string;
  retailerName: string;
  priceCents: number;
  /** ISO date of the sighting. */
  seenOn: string;
};

export type ListItemCheck = {
  itemId: string;
  name: string;
  /** The store tagged on this line, if any. */
  taggedRetailerId: string | null;
  taggedRetailerName: string | null;
  /** Every store with a recorded price, cheapest first. */
  sightings: StoreSighting[];
  cheapest: StoreSighting | null;
  /** The tagged store's own price, when there is one. */
  atTagged: StoreSighting | null;
};

export const STALE_AFTER_DAYS = 14;

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / 86_400_000);
}

export function isStale(seenOn: string, today: string): boolean {
  return daysBetween(seenOn, today) > STALE_AFTER_DAYS;
}

/**
 * What a line is worth saying out loud.
 *
 * "Cheaper elsewhere" is only claimed when the tagged store also has a price:
 * comparing a shop that has been priced against one that never has is not a
 * comparison, and reporting it as a saving would send someone somewhere else
 * on no evidence at all.
 */
export type Verdict =
  | { kind: "none"; text: string }
  | { kind: "only"; text: string }
  | { kind: "matches"; text: string }
  | { kind: "cheaper-elsewhere"; text: string; savingCents: number };

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function verdictFor(check: ListItemCheck): Verdict {
  if (check.sightings.length === 0) {
    return { kind: "none", text: "No price recorded at any of your stores yet" };
  }
  const cheapest = check.cheapest!;
  if (!check.atTagged) {
    return {
      kind: "only",
      text: check.taggedRetailerName
        ? `${money(cheapest.priceCents)} at ${cheapest.retailerName} — no price recorded at ${check.taggedRetailerName}`
        : `${money(cheapest.priceCents)} at ${cheapest.retailerName}`,
    };
  }
  if (check.atTagged.retailerId === cheapest.retailerId) {
    return {
      kind: "matches",
      text: `${money(check.atTagged.priceCents)} at ${check.atTagged.retailerName} — cheapest you've seen`,
    };
  }
  const saving = check.atTagged.priceCents - cheapest.priceCents;
  return {
    kind: "cheaper-elsewhere",
    savingCents: saving,
    text: `${money(cheapest.priceCents)} at ${cheapest.retailerName}, vs ${money(check.atTagged.priceCents)} at ${check.atTagged.retailerName} — ${money(saving)} less`,
  };
}
