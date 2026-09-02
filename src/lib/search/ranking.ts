/**
 * Ordering search results by how much the app actually knows about them.
 *
 * Search used to return one flat "Products" list ordered by whatever the
 * database handed back. Measured against the real catalogue that meant
 * "steak" returned 17 rows with no price on any of them, and "chicken" 37 —
 * a wall of generic catalogue entries with the answer nowhere in it.
 *
 * The split is between what the app can say something true about — a current
 * sale, a price it has seen, something the household buys — and what it
 * cannot. Both are shown, because a catalogue entry with no price is still a
 * real product you can go and check, but they are never mixed.
 */

export type RankableResult = {
  /** A live price line, e.g. "on sale $9.99 at Marilu's". */
  deal: string | null;
  /** Context, which carries the price book's figure when there is one. */
  sub: string | null;
  isRegularBuy: boolean;
};

/** A result plus whether anything is on record about what it costs. */
export type PricedResult = RankableResult & {
  /** True when the price book or a price observation knows this product. */
  hasPrice: boolean;
};

/** Products worth showing first: a price, or something the household buys. */
export function isInformative(result: PricedResult): boolean {
  return result.hasPrice || result.isRegularBuy;
}

/**
 * Lower sorts first. A live sale outranks a known usual price, which outranks
 * "we buy this but don't know what it costs"; being a regular buy lifts a
 * result within its tier without jumping it over a cheaper answer.
 */
export function rankOf(result: RankableResult): number {
  const tier = result.deal ? 0 : result.sub ? 1 : 2;
  return tier - (result.isRegularBuy ? 0.5 : 0);
}

export function sortByUsefulness<T extends RankableResult>(results: T[]): T[] {
  return [...results].sort((a, b) => rankOf(a) - rankOf(b));
}

/**
 * Unpriced catalogue matches are capped rather than allowed to fill the
 * screen. Eight is enough to show the search understood the word without
 * burying the rows that answer the question.
 */
export const MAX_UNPRICED_RESULTS = 8;
