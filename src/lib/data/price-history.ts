import { createClient } from "@/lib/supabase/server";

export type PriceHistoryEntry = {
  productId: string;
  name: string;
  last: number;
  avg: number;
  lowest: number;
  highest: number;
  bestStore: string | null;
};

export async function getPriceHistory(householdId: string | null): Promise<PriceHistoryEntry[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_snapshots")
      .select("product_id, price_cents, captured_at, retailer:retailers(name), product:products!inner(household_id, title)")
      .eq("product.household_id", householdId)
      .order("captured_at", { ascending: false });
    if (error || !data) return [];

    type Row = {
      product_id: string;
      price_cents: number;
      retailer: { name: string } | null;
      product: { title: string };
    };
    const rows = data as unknown as Row[];
    const byProduct = new Map<string, Row[]>();
    for (const r of rows) byProduct.set(r.product_id, [...(byProduct.get(r.product_id) ?? []), r]);

    return [...byProduct.entries()].map(([productId, entries]) => {
      const prices = entries.map((e) => e.price_cents);
      const storeCounts = new Map<string, number>();
      for (const e of entries) {
        if (!e.retailer?.name) continue;
        storeCounts.set(e.retailer.name, (storeCounts.get(e.retailer.name) ?? 0) + 1);
      }
      const bestStore = [...storeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        productId,
        name: entries[0].product.title,
        last: entries[0].price_cents,
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        lowest: Math.min(...prices),
        highest: Math.max(...prices),
        bestStore,
      };
    });
  } catch {
    return [];
  }
}
