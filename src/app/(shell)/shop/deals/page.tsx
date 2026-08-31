export const maxDuration = 60;

import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { bestPricesFromRows } from "@/lib/data/deals";
import { getPriceBookRows } from "@/lib/data/price-book";
import { getStores } from "@/lib/data/stores";
import { getLastFlyerScan, getLiveDeals, getOnlinePrices } from "@/lib/data/flyer-deals";
import type { PriceBookEntry } from "@/lib/pricing/price-book";
import { DealsView } from "./deals-view";

export default async function DealsPage() {
  const householdId = await getCurrentHouseholdId();
  const [rows, stores, liveDeals, onlinePrices, lastScan] = await Promise.all([
    getPriceBookRows(householdId),
    getStores(),
    getLiveDeals(householdId),
    getOnlinePrices(householdId),
    getLastFlyerScan(householdId),
  ]);

  // Only products the household has a real price for are sent to the client,
  // so the payload is bounded by what's been bought rather than by the
  // catalogue. A product missing from this map is genuinely unknown, and the
  // price check says so instead of guessing.
  const book: Record<string, PriceBookEntry> = Object.fromEntries(
    rows.map((row) => [row.catalogProductId, row]),
  );

  return (
    <DealsView
      book={book}
      bestPrices={bestPricesFromRows(rows)}
      stores={stores}
      liveDeals={liveDeals}
      onlinePrices={onlinePrices}
      lastScan={lastScan}
    />
  );
}
