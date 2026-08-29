import { createClient } from "@/lib/supabase/server";

export type HomeStats = {
  activeGroceryCount: number;
  dealsCount: number;
  watchCount: number;
  lastReceipt: { store: string | null; total_cents: number; purchased_at: string } | null;
};

export async function getHomeStats(householdId: string | null): Promise<HomeStats> {
  const empty: HomeStats = { activeGroceryCount: 0, dealsCount: 0, watchCount: 0, lastReceipt: null };
  if (!householdId) return empty;

  try {
    const supabase = await createClient();
    const [groceryRes, watchRes, dealsRes, receiptRes] = await Promise.all([
      supabase
        .from("grocery_items")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId)
        .eq("checked", false),
      supabase
        .from("watch_items")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId)
        .eq("status", "watching"),
      supabase
        .from("price_snapshots")
        .select("id, product:products!inner(household_id)", { count: "exact", head: true })
        .eq("product.household_id", householdId)
        .eq("source", "scan"),
      supabase
        .from("receipts")
        .select("total_cents, purchased_at, retailer:retailers(name)")
        .eq("household_id", householdId)
        .order("purchased_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    type ReceiptRow = { total_cents: number; purchased_at: string; retailer: { name: string } | null };
    const receipt = receiptRes.data as unknown as ReceiptRow | null;

    return {
      activeGroceryCount: groceryRes.count ?? 0,
      dealsCount: dealsRes.count ?? 0,
      watchCount: watchRes.count ?? 0,
      lastReceipt: receipt
        ? { store: receipt.retailer?.name ?? null, total_cents: receipt.total_cents, purchased_at: receipt.purchased_at }
        : null,
    };
  } catch {
    return empty;
  }
}
