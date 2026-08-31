import { getPriceBookRows, type PriceBookRow } from "@/lib/data/price-book";

/**
 * Deal detection against the household's own price book.
 *
 * There is no live retailer feed to search: the Loblaw banner endpoints the
 * adapters target refuse automated access, and defeating that is out of
 * scope. What can be answered honestly is the question that actually saves
 * money — "where has this been cheapest, and by how much?" — using prices
 * this household really paid or really saw.
 */
export type BestPrice = {
  catalogProductId: string;
  name: string;
  category: string;
  imageUrl: string | null;
  imageReady: boolean;
  isRegularBuy: boolean;
  bestCents: number;
  bestRetailer: string | null;
  typicalCents: number;
  savingVsTypicalCents: number;
};

/**
 * Products whose price book shows a real gap between the best price seen and
 * the usual one. Thin entries are excluded: with one or two sightings the
 * "best" price is just the only price, and calling it a find would be
 * inventing a saving that hasn't been demonstrated.
 */
export function bestPricesFromRows(rows: PriceBookRow[], limit = 20): BestPrice[] {
  return rows
    .filter((row) => row.confidence !== "THIN" && row.lowestCents < row.typicalCents)
    .map((row) => ({
      catalogProductId: row.catalogProductId,
      name: row.name,
      category: row.category,
      imageUrl: row.imageUrl,
      imageReady: row.imageReady,
      isRegularBuy: row.isRegularBuy,
      bestCents: row.lowestCents,
      bestRetailer: row.lowestRetailer,
      typicalCents: row.typicalCents,
      savingVsTypicalCents: row.typicalCents - row.lowestCents,
    }))
    .sort(
      (a, b) =>
        Number(b.isRegularBuy) - Number(a.isRegularBuy) ||
        b.savingVsTypicalCents - a.savingVsTypicalCents ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

/** Convenience wrapper for callers that don't already hold the price book. */
export async function getBestPrices(householdId: string | null, limit = 20): Promise<BestPrice[]> {
  return bestPricesFromRows(await getPriceBookRows(householdId), limit);
}
