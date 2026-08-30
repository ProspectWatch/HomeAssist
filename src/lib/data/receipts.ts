import { createClient } from "@/lib/supabase/server";
import type { ReceiptMatchStatus, ReceiptStatus } from "@/lib/receipts/types";

export type Receipt = {
  id: string;
  purchased_at: string | null;
  total_cents: number | null;
  retailer_name: string | null;
  item_count: number;
  status: ReceiptStatus;
  extraction_error: string | null;
};

export async function getReceipts(householdId: string | null): Promise<Receipt[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("receipts")
      .select(
        "id, purchased_at, total_cents, status, extraction_error, created_at, retailer:retailers(name), receipt_items(id)",
      )
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    type Row = {
      id: string;
      purchased_at: string | null;
      total_cents: number | null;
      status: ReceiptStatus;
      extraction_error: string | null;
      retailer: { name: string } | null;
      receipt_items: { id: string }[];
    };
    return (data as unknown as Row[]).map((r) => ({
      id: r.id,
      purchased_at: r.purchased_at,
      total_cents: r.total_cents,
      retailer_name: r.retailer?.name ?? null,
      item_count: r.receipt_items.length,
      status: r.status,
      extraction_error: r.extraction_error,
    }));
  } catch {
    return [];
  }
}

export type ReceiptLine = {
  id: string;
  raw_description: string;
  quantity: number | null;
  unit_price_cents: number | null;
  line_total_cents: number | null;
  discount_cents: number | null;
  line_type: string;
  match_status: ReceiptMatchStatus;
  match_confidence: number | null;
  catalog_product_id: string | null;
  catalog_product_name: string | null;
  confirmed_by_user: boolean;
};

export type ReceiptDetail = {
  id: string;
  status: ReceiptStatus;
  retailer_name: string | null;
  purchased_at: string | null;
  purchased_time: string | null;
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  raw_text: string | null;
  extraction_confidence: number | null;
  extraction_error: string | null;
  lines: ReceiptLine[];
};

/** Full receipt for the review screen. Household-scoped by query, not by trust. */
export async function getReceiptDetail(
  householdId: string | null,
  receiptId: string,
): Promise<ReceiptDetail | null> {
  if (!householdId) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("receipts")
      .select(
        "id, status, purchased_at, purchased_time, subtotal_cents, tax_cents, total_cents, raw_text, extraction_confidence, extraction_error, retailer:retailers(name), receipt_items(id, raw_description, name, quantity, unit_price_cents, line_total_cents, discount_cents, line_type, match_status, match_confidence, confirmed_by_user, sort_order, catalog_product:catalog_products(display_name))",
      )
      .eq("id", receiptId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (error || !data) return null;

    type LineRow = {
      id: string;
      raw_description: string | null;
      name: string | null;
      quantity: number | null;
      unit_price_cents: number | null;
      line_total_cents: number | null;
      discount_cents: number | null;
      line_type: string;
      match_status: ReceiptMatchStatus;
      match_confidence: number | null;
      confirmed_by_user: boolean;
      sort_order: number;
      catalog_product: { display_name: string } | null;
    };
    type Row = {
      id: string;
      status: ReceiptStatus;
      purchased_at: string | null;
      purchased_time: string | null;
      subtotal_cents: number | null;
      tax_cents: number | null;
      total_cents: number | null;
      raw_text: string | null;
      extraction_confidence: number | null;
      extraction_error: string | null;
      retailer: { name: string } | null;
      receipt_items: LineRow[];
    };
    const row = data as unknown as Row;

    return {
      id: row.id,
      status: row.status,
      retailer_name: row.retailer?.name ?? null,
      purchased_at: row.purchased_at,
      purchased_time: row.purchased_time,
      subtotal_cents: row.subtotal_cents,
      tax_cents: row.tax_cents,
      total_cents: row.total_cents,
      raw_text: row.raw_text,
      extraction_confidence: row.extraction_confidence,
      extraction_error: row.extraction_error,
      lines: [...row.receipt_items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => ({
          id: l.id,
          raw_description: l.raw_description ?? l.name ?? "",
          quantity: l.quantity,
          unit_price_cents: l.unit_price_cents,
          line_total_cents: l.line_total_cents,
          discount_cents: l.discount_cents,
          line_type: l.line_type,
          match_status: l.match_status,
          match_confidence: l.match_confidence,
          catalog_product_id: null,
          catalog_product_name: l.catalog_product?.display_name ?? null,
          confirmed_by_user: l.confirmed_by_user,
        })),
    };
  } catch {
    return null;
  }
}

export type PriceHistoryEntry = {
  observedAt: string;
  retailerName: string | null;
  priceCents: number;
  sourceType: string;
};

/**
 * Real observed price history for one product. Source type is carried through
 * so the UI can distinguish a price PAID (receipt) from one advertised (§17).
 */
export async function getProductPriceHistory(
  catalogProductId: string,
  limit = 20,
): Promise<PriceHistoryEntry[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("retailer_price_observations")
      .select("observed_at, observed_price_cents, source_type, retailer:retailers(name)")
      .eq("catalog_product_id", catalogProductId)
      .order("observed_at", { ascending: false })
      .limit(limit);
    type Row = {
      observed_at: string;
      observed_price_cents: number;
      source_type: string;
      retailer: { name: string } | null;
    };
    return ((data ?? []) as unknown as Row[]).map((r) => ({
      observedAt: r.observed_at,
      retailerName: r.retailer?.name ?? null,
      priceCents: r.observed_price_cents,
      sourceType: r.source_type,
    }));
  } catch {
    return [];
  }
}
