import { formatCents } from "@/lib/money";

/**
 * The price book — the household's own record of what things actually cost.
 *
 * This is the deal engine we can honestly build today. Live retailer pricing
 * is blocked (the Loblaw banner endpoints answer 401 to an identified,
 * non-browser client, and defeating that is out of scope), so there is no
 * feed of current shelf prices to search. What there *is*, and what grows
 * with every receipt, is a real record of what this household paid, where,
 * and when. That is enough to answer the question deal searching is actually
 * for: "is the price in front of me a good one?"
 *
 * Every number here traces to a real sighting. Nothing is modelled, inferred
 * from list prices, or filled in with a plausible average — an entry with no
 * sightings reports NONE and says so, rather than guessing.
 */

/** Where a sighting came from. `paid` is a real purchase off a receipt;
 *  `seen` is a price observed without buying (logged by hand, or from a
 *  retailer adapter once one can legitimately reach live pricing). */
export type SightingKind = "paid" | "seen";

export type PriceSighting = {
  catalogProductId: string;
  /** Price for one unit of whatever was bought. Unit price when the source
   *  records one, otherwise the line total — never a derived guess. */
  priceCents: number;
  /** Calendar date, YYYY-MM-DD. */
  observedOn: string;
  retailerName: string | null;
  kind: SightingKind;
  /** The source recorded a discount or promotion on this sighting. A price
   *  that was only that low because it was on sale is still a real price,
   *  but it says something different about the shelf price. */
  onPromotion: boolean;
  /** The receipt this came off, when it came off one. Carried so a receipt
   *  can be judged against a book that excludes it — a line compared to a
   *  book containing itself always looks like it matched the best price. */
  receiptId: string | null;
};

/**
 * How much weight the book's own numbers can carry. Two sightings of a
 * product cannot establish a "usual price", and saying so is the difference
 * between advice and noise.
 */
export type PriceConfidence = "NONE" | "THIN" | "FAIR" | "GOOD";

export const CONFIDENCE_THRESHOLDS = { fair: 3, good: 6 } as const;

export function confidenceFor(sightings: number): PriceConfidence {
  if (sightings <= 0) return "NONE";
  if (sightings >= CONFIDENCE_THRESHOLDS.good) return "GOOD";
  if (sightings >= CONFIDENCE_THRESHOLDS.fair) return "FAIR";
  return "THIN";
}

export type RetailerPrice = {
  name: string;
  bestCents: number;
  sightings: number;
};

export type PriceBookEntry = {
  catalogProductId: string;
  sightings: number;
  paidSightings: number;
  /** Most recent sighting. */
  lastCents: number;
  lastOn: string;
  lastRetailer: string | null;
  /** Median, not mean: one clearance buy shouldn't drag the "usual" down. */
  typicalCents: number;
  lowestCents: number;
  lowestRetailer: string | null;
  lowestOn: string;
  highestCents: number;
  /** What shopping around this product is worth, at most. */
  spreadCents: number;
  confidence: PriceConfidence;
  /** Best price seen per retailer, cheapest first. */
  retailers: RetailerPrice[];
};

/** Median of a non-empty list. Even counts take the lower of the two middles,
 *  so the result is always a price that was actually paid. */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/** Newest first; ties broken so the ordering is stable across calls. */
function byDateDesc(a: PriceSighting, b: PriceSighting): number {
  if (a.observedOn !== b.observedOn) return a.observedOn < b.observedOn ? 1 : -1;
  return a.priceCents - b.priceCents;
}

export function buildPriceBookEntry(sightings: PriceSighting[]): PriceBookEntry | null {
  if (sightings.length === 0) return null;

  const ordered = [...sightings].sort(byDateDesc);
  const newest = ordered[0];
  const prices = ordered.map((s) => s.priceCents);

  // Cheapest sighting; on a tie the more recent one wins, because that's the
  // price you could plausibly get again.
  const cheapest = ordered.reduce((best, s) => (s.priceCents < best.priceCents ? s : best), ordered[0]);

  const byRetailer = new Map<string, RetailerPrice>();
  for (const s of ordered) {
    if (!s.retailerName) continue;
    const existing = byRetailer.get(s.retailerName);
    if (existing) {
      existing.bestCents = Math.min(existing.bestCents, s.priceCents);
      existing.sightings += 1;
    } else {
      byRetailer.set(s.retailerName, { name: s.retailerName, bestCents: s.priceCents, sightings: 1 });
    }
  }

  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);

  return {
    catalogProductId: newest.catalogProductId,
    sightings: ordered.length,
    paidSightings: ordered.filter((s) => s.kind === "paid").length,
    lastCents: newest.priceCents,
    lastOn: newest.observedOn,
    lastRetailer: newest.retailerName,
    typicalCents: median(prices),
    lowestCents: lowest,
    lowestRetailer: cheapest.retailerName,
    lowestOn: cheapest.observedOn,
    highestCents: highest,
    spreadCents: highest - lowest,
    confidence: confidenceFor(ordered.length),
    retailers: [...byRetailer.values()].sort((a, b) => a.bestCents - b.bestCents || a.name.localeCompare(b.name)),
  };
}

export function buildPriceBook(sightings: PriceSighting[]): Map<string, PriceBookEntry> {
  const grouped = new Map<string, PriceSighting[]>();
  for (const s of sightings) {
    const bucket = grouped.get(s.catalogProductId);
    if (bucket) bucket.push(s);
    else grouped.set(s.catalogProductId, [s]);
  }

  const book = new Map<string, PriceBookEntry>();
  for (const [id, group] of grouped) {
    const entry = buildPriceBookEntry(group);
    if (entry) book.set(id, entry);
  }
  return book;
}

/** Fractions of the typical price. Deliberately asymmetric: shelf prices
 *  drift up in small steps, so a 6% rise is worth noticing, while 6% off is
 *  not yet a deal worth changing plans for. */
export const PRICE_BANDS = { good: 0.1, high: 0.05 } as const;

export type PriceVerdictCode = "NO_HISTORY" | "BEST_EVER" | "GOOD" | "TYPICAL" | "HIGH";

export type PriceVerdict = {
  code: PriceVerdictCode;
  headline: string;
  detail: string;
  /** Signed difference from the usual price. Negative = cheaper. */
  vsTypicalCents: number | null;
  vsLowestCents: number | null;
  confidence: PriceConfidence;
};

/**
 * Judges `priceCents` against what this household has actually paid.
 *
 * The strength of the claim is tied to the evidence behind it: with one
 * recorded price the verdict says "cheaper than the one price you've
 * recorded", not "best ever". A price book with two sightings does not get
 * to sound like a price book with twenty.
 */
export function assessPrice(entry: PriceBookEntry | null, priceCents: number): PriceVerdict {
  if (!entry) {
    return {
      code: "NO_HISTORY",
      headline: "No price history yet",
      detail: "Nothing recorded for this product, so there's nothing honest to compare against. Scan a receipt with it on, or log the price, and the next check will have something to say.",
      vsTypicalCents: null,
      vsLowestCents: null,
      confidence: "NONE",
    };
  }

  const vsTypical = priceCents - entry.typicalCents;
  const vsLowest = priceCents - entry.lowestCents;
  const base = { vsTypicalCents: vsTypical, vsLowestCents: vsLowest, confidence: entry.confidence };
  const seenPhrase = describeEvidence(entry);

  if (priceCents <= entry.lowestCents) {
    const matches = priceCents === entry.lowestCents;
    if (entry.confidence === "THIN") {
      return {
        ...base,
        code: "BEST_EVER",
        headline: matches ? "Same as you've paid" : "Cheaper than you've paid",
        detail: `${seenPhrase} ${matches ? "This matches it" : `That's ${formatCents(-vsLowest)} under it`} — but one or two sightings isn't enough to call it a good price yet.`,
      };
    }
    return {
      ...base,
      code: "BEST_EVER",
      headline: matches ? "Matches your best price" : "Best price you've seen",
      detail: matches
        ? `${seenPhrase} Your best is ${formatCents(entry.lowestCents)}${entry.lowestRetailer ? ` at ${entry.lowestRetailer}` : ""}, and this matches it.`
        : `${seenPhrase} Beats your previous best of ${formatCents(entry.lowestCents)}${entry.lowestRetailer ? ` at ${entry.lowestRetailer}` : ""} by ${formatCents(-vsLowest)}.`,
    };
  }

  const offTypical = entry.typicalCents > 0 ? (entry.typicalCents - priceCents) / entry.typicalCents : 0;

  if (offTypical >= PRICE_BANDS.good) {
    return {
      ...base,
      code: "GOOD",
      headline: "Good price",
      detail: `${seenPhrase} That's ${formatCents(-vsTypical)} under your usual ${formatCents(entry.typicalCents)} — about ${Math.round(offTypical * 100)}% off what you normally pay.`,
    };
  }

  if (offTypical <= -PRICE_BANDS.high) {
    return {
      ...base,
      code: "HIGH",
      headline: "Higher than usual",
      detail: `${seenPhrase} That's ${formatCents(vsTypical)} over your usual ${formatCents(entry.typicalCents)}. Your best was ${formatCents(entry.lowestCents)}${entry.lowestRetailer ? ` at ${entry.lowestRetailer}` : ""}.`,
    };
  }

  return {
    ...base,
    code: "TYPICAL",
    headline: "About what you normally pay",
    detail: `${seenPhrase} Your usual is ${formatCents(entry.typicalCents)}, so this is in the normal range.`,
  };
}

/** One clause stating exactly how much evidence the verdict rests on. */
export function describeEvidence(entry: PriceBookEntry): string {
  const times = entry.sightings === 1 ? "once" : `${entry.sightings} times`;
  const stores = entry.retailers.length;
  const where = stores > 1 ? ` across ${stores} stores` : stores === 1 ? ` at ${entry.retailers[0].name}` : "";
  return `Recorded ${times}${where}.`;
}

/**
 * Whether a verdict earns a place in a review list. A HIGH call on one or two
 * sightings is a guess dressed as a warning, so it stays out until the book
 * has enough behind it.
 */
export function isNotable(verdict: PriceVerdict): boolean {
  if (verdict.code === "BEST_EVER") return verdict.confidence !== "THIN";
  if (verdict.code === "HIGH" || verdict.code === "GOOD") {
    return verdict.confidence === "FAIR" || verdict.confidence === "GOOD";
  }
  return false;
}
