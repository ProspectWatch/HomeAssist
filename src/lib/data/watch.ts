import { createClient } from "@/lib/supabase/server";
import type { PriceStatus } from "@/components/ui/status-badge";

export type WatchItem = {
  id: string;
  title: string;
  category: string | null;
  department_key: string | null;
  target_price_cents: number | null;
  regular_price_cents: number | null;
  current_price_cents: number | null;
  lowest_price_cents: number | null;
  price_status: PriceStatus;
  retailer_name: string | null;
  athlete_name: string | null;
  needed_by: string | null;
  notes: string | null;
};

type WatchRow = {
  id: string;
  category: string | null;
  target_price_cents: number | null;
  regular_price_cents: number | null;
  price_status: PriceStatus;
  needed_by: string | null;
  notes: string | null;
  product: {
    id: string;
    title: string;
    department_key: string | null;
    retailer: { name: string } | null;
  } | null;
  athlete: { name: string } | null;
};

export async function getWatchItems(householdId: string | null): Promise<WatchItem[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("watch_items")
      .select(
        "id, category, target_price_cents, regular_price_cents, price_status, needed_by, notes, product:products(id, title, department_key, retailer:retailers(name)), athlete:athletes(name)",
      )
      .eq("household_id", householdId)
      .eq("status", "watching")
      .order("created_at", { ascending: false });
    if (error || !data) return [];

    const rows = data as unknown as WatchRow[];
    const productIds = rows.map((r) => r.product?.id).filter((v): v is string => !!v);
    const priceByProduct = new Map<string, { current: number | null; lowest: number | null }>();
    if (productIds.length > 0) {
      const { data: snapshots } = await supabase
        .from("price_snapshots")
        .select("product_id, price_cents, captured_at")
        .in("product_id", productIds)
        .order("captured_at", { ascending: false });
      for (const s of snapshots ?? []) {
        const existing = priceByProduct.get(s.product_id);
        if (!existing) {
          priceByProduct.set(s.product_id, { current: s.price_cents, lowest: s.price_cents });
        } else if (existing.lowest === null || s.price_cents < existing.lowest) {
          existing.lowest = s.price_cents;
        }
      }
    }

    return rows
      .filter((r) => r.product)
      .map((r) => {
        const prices = priceByProduct.get(r.product!.id);
        return {
          id: r.id,
          title: r.product!.title,
          category: r.category,
          department_key: r.product!.department_key,
          target_price_cents: r.target_price_cents,
          regular_price_cents: r.regular_price_cents,
          current_price_cents: prices?.current ?? null,
          lowest_price_cents: prices?.lowest ?? null,
          price_status: r.price_status,
          retailer_name: r.product!.retailer?.name ?? null,
          athlete_name: r.athlete?.name ?? null,
          needed_by: r.needed_by,
          notes: r.notes,
        };
      });
  } catch {
    return [];
  }
}

export type WatchSpec = {
  id: string;
  title: string;
  brands: string | null;
  requirements: string | null;
  max_price_cents: number | null;
};

export async function getWatchSpecs(householdId: string | null): Promise<WatchSpec[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("watch_specs")
      .select("id, title, brands, requirements, max_price_cents")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}
