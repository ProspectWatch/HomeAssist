import { createClient } from "@/lib/supabase/server";

/**
 * How much of a thing the household has. UNKNOWN is the honest default for a
 * product nobody has reviewed yet — it is represented by the ABSENCE of a
 * household_inventory_state row, never by seeding 146 rows that claim a state
 * the household never asserted.
 */
export type InventoryStatus = "UNKNOWN" | "IN_STOCK" | "LOW" | "OUT";

export type InventoryCounts = { inStock: number; low: number; out: number; unknown: number };

/** catalog_product_id -> status, for every product the household has reviewed. */
export async function getInventoryMap(
  householdId: string | null,
): Promise<Map<string, InventoryStatus>> {
  const map = new Map<string, InventoryStatus>();
  if (!householdId) return map;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("household_inventory_state")
      .select("catalog_product_id, status")
      .eq("household_id", householdId);
    if (error || !data) return map;
    for (const row of data as { catalog_product_id: string; status: InventoryStatus }[]) {
      map.set(row.catalog_product_id, row.status);
    }
    return map;
  } catch {
    return map;
  }
}

/**
 * Low/out counts for the Home screen. Counts only what the household has
 * actually told us — an unreviewed pantry reports zeros, which is true, rather
 * than implying everything is fine.
 */
export async function getInventoryCounts(householdId: string | null): Promise<InventoryCounts> {
  const empty: InventoryCounts = { inStock: 0, low: 0, out: 0, unknown: 0 };
  if (!householdId) return empty;
  try {
    const supabase = await createClient();
    const [stateRes, regularRes] = await Promise.all([
      supabase
        .from("household_inventory_state")
        .select("catalog_product_id, status")
        .eq("household_id", householdId),
      supabase
        .from("household_product_preferences")
        .select("scope_key")
        .eq("household_id", householdId)
        .eq("scope_type", "product")
        .eq("regular_buy", true),
    ]);

    const rows = (stateRes.data ?? []) as { catalog_product_id: string; status: InventoryStatus }[];
    const regularBuyIds = new Set(
      ((regularRes.data ?? []) as { scope_key: string }[]).map((r) => r.scope_key),
    );

    const counts = { ...empty };
    const reviewed = new Set<string>();
    for (const row of rows) {
      // Only count reviewed products that are still regular buys.
      if (!regularBuyIds.has(row.catalog_product_id)) continue;
      reviewed.add(row.catalog_product_id);
      if (row.status === "IN_STOCK") counts.inStock++;
      else if (row.status === "LOW") counts.low++;
      else if (row.status === "OUT") counts.out++;
    }
    counts.unknown = regularBuyIds.size - reviewed.size;
    return counts;
  } catch {
    return empty;
  }
}
