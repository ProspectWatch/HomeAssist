import { createClient } from "@/lib/supabase/server";

export type Receipt = {
  id: string;
  purchased_at: string;
  total_cents: number;
  retailer_name: string | null;
  item_count: number;
};

export async function getReceipts(householdId: string | null): Promise<Receipt[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("receipts")
      .select("id, purchased_at, total_cents, retailer:retailers(name), receipt_items(id)")
      .eq("household_id", householdId)
      .order("purchased_at", { ascending: false });
    if (error || !data) return [];
    type Row = { id: string; purchased_at: string; total_cents: number; retailer: { name: string } | null; receipt_items: { id: string }[] };
    return (data as unknown as Row[]).map((r) => ({
      id: r.id,
      purchased_at: r.purchased_at,
      total_cents: r.total_cents,
      retailer_name: r.retailer?.name ?? null,
      item_count: r.receipt_items.length,
    }));
  } catch {
    return [];
  }
}
