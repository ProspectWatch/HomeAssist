import { getPriceBookExcludingReceipt, unitPriceCents } from "@/lib/data/price-book";
import { assessPrice, isNotable, type PriceVerdict } from "@/lib/pricing/price-book";
import type { ReceiptDetail } from "@/lib/data/receipts";

export type ReceiptPriceNote = {
  lineId: string;
  name: string;
  priceCents: number;
  verdict: PriceVerdict;
};

/**
 * What this receipt says about prices, judged against everything the
 * household knew *before* it.
 *
 * Only lines with enough history behind them appear (see `isNotable`): a
 * product bought for the first time has nothing to be measured against, and
 * saying "best price ever" about the only price on record would be flattery,
 * not information.
 */
export async function getReceiptPriceNotes(
  householdId: string | null,
  receipt: ReceiptDetail,
): Promise<ReceiptPriceNote[]> {
  if (!householdId) return [];
  try {
    const book = await getPriceBookExcludingReceipt(householdId, receipt.id);
    if (book.size === 0) return [];

    const notes: ReceiptPriceNote[] = [];
    for (const line of receipt.lines) {
      if (line.line_type !== "ITEM" && line.line_type !== "UNKNOWN") continue;
      if (!line.catalog_product_id || line.match_status === "IGNORED") continue;
      if (line.line_total_cents == null) continue;

      const priceCents = unitPriceCents({
        quantity: line.quantity,
        unit_price_cents: line.unit_price_cents,
        line_total_cents: line.line_total_cents,
      });
      if (priceCents <= 0) continue;

      const verdict = assessPrice(book.get(line.catalog_product_id) ?? null, priceCents);
      if (!isNotable(verdict)) continue;

      notes.push({
        lineId: line.id,
        name: line.catalog_product_name ?? line.raw_description,
        priceCents,
        verdict,
      });
    }

    // Overpayments first — they're the ones worth acting on next trip.
    const rank = { HIGH: 0, BEST_EVER: 1, GOOD: 2 } as Record<string, number>;
    return notes.sort(
      (a, b) => (rank[a.verdict.code] ?? 9) - (rank[b.verdict.code] ?? 9) || a.name.localeCompare(b.name),
    );
  } catch {
    return [];
  }
}
