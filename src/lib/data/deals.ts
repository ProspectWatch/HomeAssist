import { createClient } from "@/lib/supabase/server";

export type Deal = {
  id: string;
  title: string;
  price_cents: number;
  regular_price_cents: number | null;
  retailer_name: string | null;
  image_url: string | null;
};

/**
 * A "deal" is a scan-sourced price_snapshot that beat a household's target
 * price on a product it's watching or regularly buys. Real query against
 * the real schema — but until the scan pipeline (§4 of the architecture
 * doc) actually runs, there are no source='scan' rows to match, so this
 * is always empty today. That's the truthful state, not a placeholder.
 */
export async function getDeals(householdId: string | null): Promise<Deal[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("price_snapshots")
      .select(
        "id, price_cents, product:products!inner(household_id, title, image_url, target_price_cents, retailer:retailers(name))",
      )
      .eq("product.household_id", householdId)
      .eq("source", "scan")
      .order("captured_at", { ascending: false })
      .limit(20);
    if (error || !data) return [];
    type Row = {
      id: string;
      price_cents: number;
      product: {
        title: string;
        image_url: string | null;
        target_price_cents: number | null;
        retailer: { name: string } | null;
      };
    };
    return (data as unknown as Row[]).map((row) => ({
      id: row.id,
      title: row.product.title,
      price_cents: row.price_cents,
      regular_price_cents: row.product.target_price_cents,
      retailer_name: row.product.retailer?.name ?? null,
      image_url: row.product.image_url,
    }));
  } catch {
    return [];
  }
}

export async function getLastScanTime(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("scan_jobs")
      .select("finished_at")
      .eq("status", "succeeded")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.finished_at ?? null;
  } catch {
    return null;
  }
}
