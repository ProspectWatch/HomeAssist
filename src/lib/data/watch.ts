import { createClient } from "@/lib/supabase/server";
import type { PriceStatus } from "@/components/ui/status-badge";
import { getPriceBook } from "@/lib/data/price-book";

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
  /** The product's own photograph, where the household has one. */
  image_url: string | null;
  /** Where the cheapest price came from, so the row says where to buy it. */
  lowest_retailer: string | null;
  /** How many sightings the price rests on — one price is not a price history. */
  sightings: number;
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
    image_url: string | null;
    catalog_product_id: string | null;
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
        "id, category, target_price_cents, regular_price_cents, price_status, needed_by, notes, product:products(id, title, department_key, image_url, catalog_product_id, retailer:retailers(name)), athlete:athletes(name)",
      )
      .eq("household_id", householdId)
      .eq("status", "watching")
      .order("created_at", { ascending: false });
    if (error || !data) return [];

    const rows = data as unknown as WatchRow[];

    // Prices come from the price book — household purchases and the retailer
    // observations the flyer scan writes — not from price_snapshots. That table
    // was scaffolding for a pipeline that was built somewhere else: nothing has
    // ever written a row to it, so every watched item reported no price at all
    // while the prices it wanted were sitting one table over. Deals and Price
    // History were rewired off it earlier; this was the last reader left.
    const book = await getPriceBook(householdId);

    return rows
      .filter((r) => r.product)
      .map((r) => {
        const catalogId = r.product!.catalog_product_id;
        const entry = catalogId ? book.get(catalogId) : undefined;
        return {
          id: r.id,
          title: r.product!.title,
          category: r.category,
          department_key: r.product!.department_key,
          target_price_cents: r.target_price_cents,
          regular_price_cents: r.regular_price_cents,
          current_price_cents: entry?.lastCents ?? null,
          lowest_price_cents: entry?.lowestCents ?? null,
          price_status: r.price_status,
          retailer_name: r.product!.retailer?.name ?? null,
          athlete_name: r.athlete?.name ?? null,
          needed_by: r.needed_by,
          notes: r.notes,
          image_url: r.product!.image_url,
          lowest_retailer: entry?.lowestRetailer ?? null,
          sightings: entry?.sightings ?? 0,
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
