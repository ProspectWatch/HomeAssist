import { createClient } from "@/lib/supabase/server";

// The generic, reusable product dictionary (catalog_products) — distinct
// from `products`, which is a household's own tracked SKU. See migration
// 0004_product_catalog.sql for the full data model and rationale.

export type CatalogProduct = {
  id: string;
  display_name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  search_aliases: string[];
  default_unit: string | null;
  image_url: string | null;
  image_ready: boolean;
  preferred_store_hint: string | null;
};

const CATALOG_FIELDS =
  "id, display_name, brand, category, subcategory, search_aliases, default_unit, image_url, image_ready, preferred_store_hint";

/**
 * The whole active catalogue (~170 rows) for client-side instant search —
 * step 11's "client-side cached catalogue for this catalogue size" call.
 * Exposed to the browser via /api/catalog; also usable directly from
 * server components (category browsing, recipe ingredient mapping).
 */
export async function getCatalogSearchIndex(): Promise<CatalogProduct[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("catalog_products")
      .select(CATALOG_FIELDS)
      .eq("active", true)
      .order("display_name", { ascending: true });
    if (error || !data) return [];
    return data as unknown as CatalogProduct[];
  } catch {
    return [];
  }
}

/**
 * Server-side search fallback (SSR pages, no-JS path). The trigram index
 * on catalog_products.search_text backs this; the browser normally uses
 * the cached full index instead for zero-latency typeahead.
 */
export async function searchCatalogProducts(query: string, limit = 20): Promise<CatalogProduct[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const supabase = await createClient();
    const like = `%${q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}%`;
    const { data, error } = await supabase
      .from("catalog_products")
      .select(CATALOG_FIELDS)
      .eq("active", true)
      .ilike("search_text", like)
      .order("display_name", { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return data as unknown as CatalogProduct[];
  } catch {
    return [];
  }
}

export type CatalogCategory = {
  name: string;
  sort_order: number;
  subcategories: { name: string; sort_order: number; product_count: number }[];
};

/** Category -> subcategory -> product browsing tree (step 5). */
export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  try {
    const supabase = await createClient();
    const [categories, subcategories, products] = await Promise.all([
      supabase.from("product_categories").select("name, sort_order").order("sort_order"),
      supabase.from("product_subcategories").select("category, name, sort_order").order("sort_order"),
      supabase.from("catalog_products").select("category, subcategory").eq("active", true),
    ]);
    if (categories.error || !categories.data) return [];

    const counts = new Map<string, number>();
    for (const p of products.data ?? []) {
      if (!p.subcategory) continue;
      const key = `${p.category}::${p.subcategory}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return categories.data.map((cat) => ({
      name: cat.name,
      sort_order: cat.sort_order,
      subcategories: (subcategories.data ?? [])
        .filter((s) => s.category === cat.name)
        .map((s) => ({
          name: s.name,
          sort_order: s.sort_order,
          product_count: counts.get(`${cat.name}::${s.name}`) ?? 0,
        })),
    }));
  } catch {
    return [];
  }
}

export async function getCatalogProductsForSubcategory(
  category: string,
  subcategory: string,
): Promise<CatalogProduct[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("catalog_products")
      .select(CATALOG_FIELDS)
      .eq("active", true)
      .eq("category", category)
      .eq("subcategory", subcategory)
      .order("display_name", { ascending: true });
    if (error || !data) return [];
    return data as unknown as CatalogProduct[];
  } catch {
    return [];
  }
}

export type HouseholdProductPreference = {
  id: string;
  scope_type: "category" | "subcategory" | "product";
  scope_key: string;
  label: string;
  preferred_brand: string | null;
  preferred_variant: string | null;
  preferred_size: string | null;
  preferred_store: string | null;
  acceptable_brands: string[];
  acceptable_stores: string[];
  brand_rigidity: "EXACT_ONLY" | "PREFERRED" | "FLEXIBLE";
  typical_quantity: string | null;
  notes: string | null;
};

export async function getHouseholdPreferences(householdId: string | null): Promise<HouseholdProductPreference[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("household_product_preferences")
      .select(
        "id, scope_type, scope_key, label, preferred_brand, preferred_variant, preferred_size, preferred_store, acceptable_brands, acceptable_stores, brand_rigidity, typical_quantity, notes",
      )
      .eq("household_id", householdId);
    if (error || !data) return [];
    return data as unknown as HouseholdProductPreference[];
  } catch {
    return [];
  }
}

/**
 * Resolves a household's preference for a generic catalogue product,
 * without collapsing the two: a grocery/watch/recipe row can keep
 * pointing at the generic product while this tells the UI what SKU the
 * household actually wants (step 8). Precedence: an exact product-level
 * preference beats a subcategory-level one, which beats a category-level
 * one.
 */
export function resolvePreferenceForCatalogProduct(
  preferences: HouseholdProductPreference[],
  product: Pick<CatalogProduct, "id" | "category" | "subcategory">,
): HouseholdProductPreference | null {
  const byProduct = preferences.find((p) => p.scope_type === "product" && p.scope_key === product.id);
  if (byProduct) return byProduct;
  if (product.subcategory) {
    const bySubcategory = preferences.find(
      (p) => p.scope_type === "subcategory" && p.scope_key === product.subcategory,
    );
    if (bySubcategory) return bySubcategory;
  }
  const byCategory = preferences.find((p) => p.scope_type === "category" && p.scope_key === product.category);
  return byCategory ?? null;
}
