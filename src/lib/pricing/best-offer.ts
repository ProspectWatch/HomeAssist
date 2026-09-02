/**
 * The best current price for a product, across every source the app has.
 *
 * Search used to read only FLYER observations, which made sense when flyers
 * were the only thing being collected. They are not: this household now also
 * has Marilu's prices read from its Instacart listing, retailers' own website
 * prices, and prices off its own receipts. Filtering to flyers meant searching
 * for chicken breast could not show the Marilu's price even though it was
 * sitting in the same table.
 *
 * Two distinctions are kept rather than flattened, because they change what
 * the number means:
 *
 *   A sale is not an everyday price. A flyer price is temporary and worth
 *   acting on; a shelf price is just what the thing costs. Both are useful and
 *   they are not the same claim, so the source is carried through.
 *
 *   A price has an age. An offer with an expiry that has passed is dropped
 *   outright, and one collected weeks ago is reported with its date rather
 *   than presented as today's.
 */

export type OfferSource = "FLYER" | "ONLINE" | "RECEIPT" | "MANUAL" | "OTHER";

export type ProductOffer = {
  catalogProductId: string;
  priceCents: number;
  retailerName: string | null;
  source: OfferSource;
  /** YYYY-MM-DD. */
  observedOn: string;
  /** YYYY-MM-DD, or null when the price has no stated end. */
  validUntil: string | null;
};

export function classifySource(sourceType: string): OfferSource {
  if (sourceType === "FLYER") return "FLYER";
  if (sourceType === "RECEIPT") return "RECEIPT";
  if (sourceType === "MANUAL") return "MANUAL";
  // ONLINE, RETAILER_LIVE and the adapters (Marilu's via Instacart) are all a
  // price a shop is listing right now.
  return sourceType === "ONLINE" || sourceType.startsWith("adapter:") || sourceType === "RETAILER_LIVE"
    ? "ONLINE"
    : "OTHER";
}

/** A flyer offer whose end date has passed is not a price you can go and pay. */
export function isExpired(offer: ProductOffer, today: string): boolean {
  return offer.validUntil !== null && offer.validUntil < today;
}

/** How old, in days. */
export function ageInDays(observedOn: string, today: string): number {
  const a = Date.parse(`${observedOn.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${today}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / 86_400_000);
}

/** Past this, the price is quoted with its date rather than as current. */
export const FRESH_DAYS = 14;

/**
 * Cheapest unexpired offer per product.
 *
 * Ties go to the flyer, because between two equal prices the one advertised as
 * a sale is the one with an end date on it — worth knowing about first.
 */
export function bestOfferByProduct(
  offers: ProductOffer[],
  today: string,
): Map<string, ProductOffer> {
  const best = new Map<string, ProductOffer>();
  for (const offer of offers) {
    if (isExpired(offer, today)) continue;
    const held = best.get(offer.catalogProductId);
    if (
      !held ||
      offer.priceCents < held.priceCents ||
      (offer.priceCents === held.priceCents && offer.source === "FLYER" && held.source !== "FLYER")
    ) {
      best.set(offer.catalogProductId, offer);
    }
  }
  return best;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * One line a person can act on: the price, where, and whether it is a sale.
 *
 * A stale price says how old it is instead of pretending to be current —
 * driving somewhere on a three-week-old flyer price is exactly the failure
 * this avoids.
 */
export function describeOffer(offer: ProductOffer, today: string): string {
  const where = offer.retailerName ? ` at ${offer.retailerName}` : "";
  const age = ageInDays(offer.observedOn, today);
  const when = age > FRESH_DAYS ? ` · seen ${offer.observedOn}` : "";
  const label =
    offer.source === "FLYER" ? "on sale " : offer.source === "RECEIPT" ? "you paid " : "";
  return `${label}${money(offer.priceCents)}${where}${when}`;
}
