import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import {
  buildPriceBook,
  type PriceBookEntry,
  type PriceSighting,
} from "@/lib/pricing/price-book";

/**
 * Assembles the household's price book from the two real sources of price
 * truth, and only those:
 *
 *   household_purchases            -> prices actually paid, off real receipts
 *   retailer_price_observations    -> prices seen but not paid (logged by
 *                                     hand today; retailer adapters later)
 *
 * Receipt ingestion writes to both tables, so observations whose source is a
 * receipt are excluded here — counting them again would make a single
 * purchase look like two sightings and quietly inflate the book's confidence.
 */

const PAGE_SIZE = 1000;

/** A truncated price history would report a wrong "lowest ever" while looking
 *  perfectly normal, so every page is read rather than the first 1,000 rows. */
async function readAllPages<T>(
  query: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await query(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) return all;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
}

type PurchaseRow = {
  catalog_product_id: string | null;
  receipt_id: string | null;
  purchase_date: string;
  quantity: number | null;
  unit_price_cents: number | null;
  line_total_cents: number;
  discount_cents: number | null;
  retailer: { name: string } | null;
};

type ObservationRow = {
  catalog_product_id: string | null;
  observed_price_cents: number;
  observed_on: string;
  promotion_text: string | null;
  source_type: string;
  retailer: { name: string } | null;
};

/** Price for one unit. Uses the receipt's own unit price when it recorded
 *  one; otherwise divides the line total by a real quantity. Never guesses a
 *  quantity — a line with none is taken at its face value. */
export function unitPriceCents(row: {
  quantity: number | null;
  unit_price_cents: number | null;
  line_total_cents: number;
}): number {
  if (row.unit_price_cents != null && row.unit_price_cents > 0) return row.unit_price_cents;
  if (row.quantity != null && row.quantity > 0) return Math.round(row.line_total_cents / row.quantity);
  return row.line_total_cents;
}

export async function getPriceSightings(
  householdId: string,
  /** The scheduled run passes the service-role client; a cron has no session. */
  client?: SupabaseClient<Database>,
): Promise<PriceSighting[]> {
  const supabase = client ?? (await createClient());

  const [purchases, observations] = await Promise.all([
    readAllPages<PurchaseRow>((from, to) =>
      supabase
        .from("household_purchases")
        .select("catalog_product_id, receipt_id, purchase_date, quantity, unit_price_cents, line_total_cents, discount_cents, retailer:retailers(name)")
        .eq("household_id", householdId)
        .not("catalog_product_id", "is", null)
        .order("purchase_date", { ascending: false })
        .range(from, to),
    ),
    readAllPages<ObservationRow>((from, to) =>
      supabase
        .from("retailer_price_observations")
        .select("catalog_product_id, observed_price_cents, observed_on, promotion_text, source_type, retailer:retailers(name)")
        .not("catalog_product_id", "is", null)
        // This household's own entries, plus retailer-wide adapter output
        // (household_id null), which belongs to no single household.
        .or(`household_id.eq.${householdId},household_id.is.null`)
        // RECEIPT rows mirror household_purchases, already counted above.
        // FLYER rows are advertised sale prices with an expiry date — real,
        // but not what the household normally pays. Folding a week of sale
        // prices into the median would drag "usual" down and then flag the
        // ordinary shelf price as an overpayment.
        .not("source_type", "in", "(RECEIPT,FLYER)")
        .in("match_status", ["MATCHED", "LIKELY_MATCH"])
        .order("observed_on", { ascending: false })
        .range(from, to),
    ),
  ]);

  const sightings: PriceSighting[] = [];

  for (const row of purchases) {
    if (!row.catalog_product_id) continue;
    sightings.push({
      catalogProductId: row.catalog_product_id,
      priceCents: unitPriceCents(row),
      observedOn: row.purchase_date,
      retailerName: row.retailer?.name ?? null,
      kind: "paid",
      onPromotion: (row.discount_cents ?? 0) > 0,
      receiptId: row.receipt_id,
    });
  }

  for (const row of observations) {
    if (!row.catalog_product_id) continue;
    sightings.push({
      catalogProductId: row.catalog_product_id,
      priceCents: row.observed_price_cents,
      observedOn: row.observed_on,
      retailerName: row.retailer?.name ?? null,
      kind: "seen",
      onPromotion: !!row.promotion_text,
      receiptId: null,
    });
  }

  return sightings;
}

export async function getPriceBook(
  householdId: string | null,
  client?: SupabaseClient<Database>,
): Promise<Map<string, PriceBookEntry>> {
  if (!householdId) return new Map();
  try {
    return buildPriceBook(await getPriceSightings(householdId, client));
  } catch {
    return new Map();
  }
}

export type PriceBookRow = PriceBookEntry & {
  name: string;
  category: string;
  brand: string | null;
  imageUrl: string | null;
  imageReady: boolean;
  isRegularBuy: boolean;
};

/**
 * The price book as a readable list, newest activity first. Products the
 * household has no sighting for are absent rather than listed as unknown —
 * the book is a record of what happened, not a checklist of the catalogue.
 */
export async function getPriceBookRows(householdId: string | null): Promise<PriceBookRow[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const book = await getPriceBook(householdId);
    if (book.size === 0) return [];

    const ids = [...book.keys()];
    const [productRes, prefRes] = await Promise.all([
      supabase
        .from("catalog_products")
        .select("id, display_name, brand, category, image_url, image_ready")
        .in("id", ids),
      supabase
        .from("household_product_preferences")
        .select("scope_key")
        .eq("household_id", householdId)
        .eq("scope_type", "product")
        .eq("regular_buy", true),
    ]);

    type ProductRow = {
      id: string;
      display_name: string;
      brand: string | null;
      category: string;
      image_url: string | null;
      image_ready: boolean;
    };
    const products = new Map(
      ((productRes.data ?? []) as ProductRow[]).map((p) => [p.id, p]),
    );
    const regularBuys = new Set(
      ((prefRes.data ?? []) as { scope_key: string }[]).map((r) => r.scope_key),
    );

    const rows: PriceBookRow[] = [];
    for (const [id, entry] of book) {
      const product = products.get(id);
      // A sighting whose catalogue product has since been deactivated has no
      // name to show, so it stays out of the list rather than appearing as a
      // blank row. Its history is untouched and returns with the product.
      if (!product) continue;
      rows.push({
        ...entry,
        name: product.display_name,
        category: product.category,
        brand: product.brand,
        imageUrl: product.image_url,
        imageReady: product.image_ready,
        isRegularBuy: regularBuys.has(id),
      });
    }

    return rows.sort((a, b) => (a.lastOn < b.lastOn ? 1 : a.lastOn > b.lastOn ? -1 : a.name.localeCompare(b.name)));
  } catch {
    return [];
  }
}

/**
 * The price book as it stood *before* a given receipt — the only fair frame
 * for judging that receipt's own prices. Built from the same sightings with
 * the receipt's own lines removed; including them would let every line match
 * the best price on file, because it would be the price on file.
 */
export async function getPriceBookExcludingReceipt(
  householdId: string | null,
  receiptId: string,
): Promise<Map<string, PriceBookEntry>> {
  if (!householdId) return new Map();
  try {
    const sightings = await getPriceSightings(householdId);
    return buildPriceBook(sightings.filter((s) => s.receiptId !== receiptId));
  } catch {
    return new Map();
  }
}
