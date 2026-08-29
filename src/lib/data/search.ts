"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";

export type SearchGroup = { label: string; items: { title: string; sub: string }[] };

export async function searchHousehold(query: string): Promise<SearchGroup[]> {
  const q = query.trim();
  if (!q) return [];
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return [];

  try {
    const supabase = await createClient();
    const like = `%${q}%`;

    const [watch, pantry, receipts] = await Promise.all([
      supabase
        .from("watch_items")
        .select("product:products!inner(household_id, title)")
        .eq("household_id", householdId)
        .ilike("product.title", like),
      supabase
        .from("products")
        .select("title")
        .eq("household_id", householdId)
        .eq("is_regular_buy", true)
        .ilike("title", like),
      supabase
        .from("receipts")
        .select("id, purchased_at, retailer:retailers(name)")
        .eq("household_id", householdId)
        .ilike("retailer.name", like),
    ]);

    type WatchRow = { product: { title: string } | null };
    const groups: SearchGroup[] = [
      {
        label: "Watching",
        items: ((watch.data as unknown as WatchRow[]) ?? [])
          .filter((r) => r.product)
          .map((r) => ({ title: r.product!.title, sub: "Watching" })),
      },
      {
        label: "Pantry",
        items: (pantry.data ?? []).map((r) => ({ title: r.title, sub: "Pantry" })),
      },
      {
        label: "Receipts",
        items: ((receipts.data as unknown as { retailer: { name: string } | null; purchased_at: string }[]) ?? []).map(
          (r) => ({ title: `${r.retailer?.name ?? "Unknown"} · ${r.purchased_at}`, sub: "Receipt" }),
        ),
      },
    ];
    return groups.filter((g) => g.items.length > 0);
  } catch {
    return [];
  }
}
