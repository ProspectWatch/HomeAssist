import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPriceBook } from "@/lib/data/price-book";
import {
  buildRegularBuyNotifications,
  buildTargetHitNotifications,
  type RegularBuyDeal,
  type WatchedPrice,
} from "@/lib/notifications/from-prices";

/**
 * Fills the Notifications screen after a scan.
 *
 * Runs at the end of a scan rather than on a schedule of its own: the only
 * moment anything can newly be true is when new prices arrive, and a job that
 * re-derives the same answers hourly would either say nothing or say the same
 * thing again.
 *
 * Failure here is never allowed to fail the scan. The prices are the valuable
 * part and are already stored by the time this runs; a missed notification is
 * a smaller loss than a scan that reports failure after doing its job.
 */
export async function syncPriceNotifications(householdId: string): Promise<number> {
  try {
    const supabase = await createClient();

    const [{ data: watchRows }, { data: unreadRows }, book] = await Promise.all([
      supabase
        .from("watch_items")
        .select(
          "id, target_price_cents, product:products(title, catalog_product_id, retailer:retailers(name))",
        )
        .eq("household_id", householdId)
        .eq("status", "watching"),
      supabase
        .from("notifications")
        .select("watch_item_id, title, kind")
        .eq("household_id", householdId)
        .eq("read", false),
      getPriceBook(householdId),
    ]);

    const unreadWatchIds = new Set(
      ((unreadRows ?? []) as { watch_item_id: string | null }[])
        .map((r) => r.watch_item_id)
        .filter((id): id is string => !!id),
    );
    const unreadTitles = new Set(((unreadRows ?? []) as { title: string }[]).map((r) => r.title));

    type WatchRow = {
      id: string;
      target_price_cents: number | null;
      product: {
        title: string;
        catalog_product_id: string | null;
        retailer: { name: string } | null;
      } | null;
    };

    const watched: WatchedPrice[] = ((watchRows ?? []) as unknown as WatchRow[])
      .filter((r) => r.product)
      .map((r) => {
        const entry = r.product!.catalog_product_id
          ? book.get(r.product!.catalog_product_id)
          : undefined;
        return {
          watchItemId: r.id,
          title: r.product!.title,
          targetCents: r.target_price_cents,
          observedCents: entry?.lowestCents ?? null,
          retailerName: entry?.lowestRetailer ?? r.product!.retailer?.name ?? null,
        };
      });

    const pending = buildTargetHitNotifications(watched, unreadWatchIds);

    // Regular buys have no watch item to key on, so repeats are held off by
    // title. A staple counts as news only when today's scan set a new low —
    // lowestOn being today, with more than one sighting behind it, is exactly
    // "cheaper than this house has ever seen it", and one sighting is not a
    // price history to beat.
    const today = new Date().toISOString().slice(0, 10);
    const { data: regularRows } = await supabase
      .from("household_product_preferences")
      .select("scope_key, label, catalog_product:catalog_products(display_name)")
      .eq("household_id", householdId)
      .eq("scope_type", "product")
      .eq("regular_buy", true);

    const deals: RegularBuyDeal[] = ((regularRows ?? []) as unknown as {
      scope_key: string;
      label: string;
      catalog_product: { display_name: string } | null;
    }[])
      .map((row): RegularBuyDeal | null => {
        const entry = book.get(row.scope_key);
        if (!entry || entry.sightings < 2 || entry.lowestOn.slice(0, 10) !== today) return null;
        return {
          catalogProductId: row.scope_key,
          title: row.catalog_product?.display_name ?? row.label,
          priceCents: entry.lowestCents,
          retailerName: entry.lowestRetailer,
          // The price it beat: the highest is the wrong comparison and the
          // typical is the honest one for "cheaper than usual".
          previousBestCents: entry.typicalCents,
        };
      })
      .filter((d): d is RegularBuyDeal => d !== null);

    const regular = buildRegularBuyNotifications(deals, unreadTitles);

    const rows = [...pending, ...regular];
    if (rows.length === 0) return 0;

    const { error } = await supabase.from("notifications").insert(
      rows.map((n) => ({
        household_id: householdId,
        kind: n.kind,
        title: n.title,
        body: n.body,
        watch_item_id: n.watchItemId,
      })),
    );
    if (error) return 0;
    return rows.length;
  } catch {
    return 0;
  }
}
