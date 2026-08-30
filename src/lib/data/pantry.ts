import { createClient } from "@/lib/supabase/server";
import type { InventoryStatus } from "@/lib/data/inventory";

export type PantryProduct = {
  id: string;
  /** Catalogue identity — what inventory and list actions key off. */
  catalog_product_id: string | null;
  title: string;
  category: string | null;
  package_detail: string | null;
  target_price_cents: number | null;
  /** Legacy per-SKU stock field on `products`; distinct from inventory_status. */
  stock_status: "good" | "low" | null;
  /** What the household has right now. UNKNOWN until they say otherwise. */
  inventory_status: InventoryStatus;
  /** True when this need is already on the active grocery list. */
  on_list: boolean;
  /** Where the household keeps it — a preference-layer hint, not inventory. */
  stock_location: string | null;
  image_url: string | null;
  /** e.g. "Earth's Own · Original" — the household's rule for this item. */
  preference_hint: string | null;
  retailer_name: string | null;
};

type PreferenceRow = {
  scope_key: string;
  label: string;
  stock_location: string | null;
  preferred_brand: string | null;
  preferred_variant: string | null;
  preferred_store: string | null;
  catalog_product: {
    display_name: string;
    category: string;
    default_unit: string | null;
    image_url: string | null;
    image_ready: boolean;
  } | null;
};

type LegacyProductRow = {
  id: string;
  title: string;
  package_detail: string | null;
  target_price_cents: number | null;
  stock_status: "good" | "low" | null;
  image_url: string | null;
  catalog_product_id: string | null;
  retailer: { name: string } | null;
};

/** "Earth's Own · Original · Marilu's Market" from whichever parts are set. */
function preferenceHint(row: PreferenceRow): string | null {
  const parts = [row.preferred_brand, row.preferred_variant, row.preferred_store].filter(
    (p): p is string => !!p,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The household's Regular Buys — the products it commonly keeps or buys.
 *
 * Sourced from the household preference layer
 * (household_product_preferences.regular_buy), joined to the generic
 * catalogue for name/category/image. That keeps the four concepts distinct:
 * the catalogue stays generic, the preference layer says what this household
 * wants and how, `products` holds household-owned SKUs with real inventory
 * state, and neither implies the item is in stock right now.
 *
 * Legacy/custom `products` regular buys (anything added by name rather than
 * from the catalogue) are merged in so nothing already on the screen
 * disappears; a catalogue-backed duplicate prefers the richer preference row
 * but keeps the product row's real target price and stock status.
 */
export async function getRegularBuys(householdId: string | null): Promise<PantryProduct[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const [prefRes, productRes, inventoryRes, listRes] = await Promise.all([
      supabase
        .from("household_product_preferences")
        .select(
          "scope_key, label, preferred_brand, preferred_variant, preferred_store, stock_location, catalog_product:catalog_products(display_name, category, default_unit, image_url, image_ready)",
        )
        .eq("household_id", householdId)
        .eq("scope_type", "product")
        .eq("regular_buy", true),
      supabase
        .from("products")
        .select(
          "id, title, package_detail, target_price_cents, stock_status, image_url, catalog_product_id, retailer:retailers(name)",
        )
        .eq("household_id", householdId)
        .eq("is_regular_buy", true),
      supabase
        .from("household_inventory_state")
        .select("catalog_product_id, status")
        .eq("household_id", householdId),
      supabase
        .from("grocery_items")
        .select("name, catalog_product_id")
        .eq("household_id", householdId)
        .eq("checked", false),
    ]);

    const prefRows = (prefRes.data ?? []) as unknown as PreferenceRow[];
    const productRows = (productRes.data ?? []) as unknown as LegacyProductRow[];

    const inventory = new Map<string, InventoryStatus>();
    for (const row of (inventoryRes.data ?? []) as {
      catalog_product_id: string;
      status: InventoryStatus;
    }[]) {
      inventory.set(row.catalog_product_id, row.status);
    }

    // Active list membership, by catalogue identity and by exact name for
    // rows that predate catalogue linking — the same conservative rule the
    // addHouseholdNeed service uses.
    const listCatalogIds = new Set<string>();
    const listNames = new Set<string>();
    for (const row of (listRes.data ?? []) as {
      name: string;
      catalog_product_id: string | null;
    }[]) {
      if (row.catalog_product_id) listCatalogIds.add(row.catalog_product_id);
      listNames.add(row.name.trim().toLowerCase().replace(/\s+/g, " "));
    }
    const onList = (catalogId: string | null, name: string) =>
      (catalogId !== null && listCatalogIds.has(catalogId)) ||
      listNames.has(name.trim().toLowerCase().replace(/\s+/g, " "));

    // Household SKU rows carry the only real inventory/target-price data, so
    // index them by catalogue id to enrich the preference-backed entries.
    const skuByCatalogId = new Map<string, LegacyProductRow>();
    for (const row of productRows) {
      if (row.catalog_product_id) skuByCatalogId.set(row.catalog_product_id, row);
    }

    const fromPreferences: PantryProduct[] = prefRows.map((row) => {
      const sku = skuByCatalogId.get(row.scope_key);
      const catalog = row.catalog_product;
      // §10: the need stays what the household calls it ("Eggs"), not a
      // brand-specific SKU name. The brand lives in the preference context.
      const title = row.label || catalog?.display_name || row.scope_key;
      return {
        id: `pref:${row.scope_key}`,
        catalog_product_id: row.scope_key,
        title,
        category: catalog?.category ?? null,
        package_detail: sku?.package_detail ?? catalog?.default_unit ?? null,
        target_price_cents: sku?.target_price_cents ?? null,
        stock_status: sku?.stock_status ?? null,
        inventory_status: inventory.get(row.scope_key) ?? "UNKNOWN",
        on_list: onList(row.scope_key, title),
        stock_location: row.stock_location,
        // Never show an image the catalogue hasn't marked ready.
        image_url: catalog?.image_ready ? catalog.image_url : (sku?.image_url ?? null),
        preference_hint: preferenceHint(row),
        retailer_name: sku?.retailer?.name ?? null,
      };
    });

    const covered = new Set(prefRows.map((r) => r.scope_key));
    const fromProducts: PantryProduct[] = productRows
      .filter((row) => !(row.catalog_product_id && covered.has(row.catalog_product_id)))
      .map((row) => ({
        id: row.id,
        catalog_product_id: row.catalog_product_id,
        title: row.title,
        category: null,
        package_detail: row.package_detail,
        target_price_cents: row.target_price_cents,
        stock_status: row.stock_status,
        inventory_status: row.catalog_product_id
          ? (inventory.get(row.catalog_product_id) ?? "UNKNOWN")
          : ("UNKNOWN" as const),
        on_list: onList(row.catalog_product_id, row.title),
        stock_location: null,
        image_url: row.image_url,
        preference_hint: null,
        retailer_name: row.retailer?.name ?? null,
      }));

    return [...fromPreferences, ...fromProducts].sort((a, b) => a.title.localeCompare(b.title));
  } catch {
    return [];
  }
}

/**
 * Regular buys scoped to one department/room (Bathroom, Laundry, …) rather
 * than the whole household library. These are household-owned `products`
 * rows, which is where a department key and real stock status live — the
 * Rooms screens have always read this and continue to.
 */
export async function getDepartmentRegularBuys(
  householdId: string | null,
  departmentKey: string,
): Promise<PantryProduct[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, title, package_detail, target_price_cents, stock_status, image_url, catalog_product_id, retailer:retailers(name)",
      )
      .eq("household_id", householdId)
      .eq("department_key", departmentKey)
      .eq("is_regular_buy", true)
      .order("title", { ascending: true });
    if (error || !data) return [];
    return (data as unknown as LegacyProductRow[]).map((row) => ({
      id: row.id,
      catalog_product_id: row.catalog_product_id,
      title: row.title,
      category: null,
      package_detail: row.package_detail,
      target_price_cents: row.target_price_cents,
      stock_status: row.stock_status,
      inventory_status: "UNKNOWN" as const,
      on_list: false,
      stock_location: null,
      image_url: row.image_url,
      preference_hint: null,
      retailer_name: row.retailer?.name ?? null,
    }));
  } catch {
    return [];
  }
}
