import { createClient } from "@/lib/supabase/server";
import { isBrandRigidity, type RegularBuy } from "@/lib/household/regular-buys";

// The generic, reusable product dictionary (catalog_products) — distinct
// from `products`, which is a household's own tracked SKU. See migration
// 0004_product_catalog.sql for the full data model and rationale.

export type CatalogProduct = {
  id: string;
  display_name: string;
  /**
   * True for one of the household's own branded products, folded into the same
   * index. `id` is still the catalogue id it maps to, so every caller that
   * writes `product.id` as a catalog_product_id keeps working — the difference
   * is only the name, brand and photo, which is the part a person recognises.
   */
  isHouseholdProduct?: boolean;
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

/** PostgREST caps a single response (Supabase's default is 1,000 rows), so the
 *  index is paged. Silently returning the first page would drop products out
 *  of typeahead entirely — invisibly, because a short list looks normal. */
const CATALOG_PAGE_SIZE = 1000;

/**
 * The whole active catalogue for client-side instant search — step 11's
 * "client-side cached catalogue for this catalogue size" call. Exposed to the
 * browser via /api/catalog; also usable directly from server components
 * (category browsing, recipe ingredient mapping).
 */
export async function getCatalogSearchIndex(): Promise<CatalogProduct[]> {
  try {
    const supabase = await createClient();
    const all: CatalogProduct[] = [];
    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from("catalog_products")
        .select(CATALOG_FIELDS)
        .eq("active", true)
        .order("display_name", { ascending: true })
        .range(page * CATALOG_PAGE_SIZE, (page + 1) * CATALOG_PAGE_SIZE - 1);
      if (error) return page === 0 ? [] : all;
      const rows = (data ?? []) as unknown as CatalogProduct[];
      all.push(...rows);
      if (rows.length < CATALOG_PAGE_SIZE) return all;
    }
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

/**
 * The household's tagged Regular Buys, joined to the catalogue.
 *
 * Distinct from getRegularBuys() in data/pantry.ts, which answers "what's in
 * the pantry and is it stocked". This answers "what does this household buy,
 * and which brand do they want" — the baseline deal matching reads.
 */
export async function getRegularBuyList(householdId: string | null): Promise<RegularBuy[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    // Both layers, because a regular buy can live in either and this screen
    // was only ever reading one. The household's branded products -- the 67
    // photographed off their own shelves -- sit in `products`, so starring
    // them in Pantry changed nothing here and the screen looked broken.
    // Pantry has always merged the two; this now matches it.
    const [prefRes, productRes] = await Promise.all([
      supabase
        .from("household_product_preferences")
        .select(
          "scope_key, label, preferred_brand, brand_rigidity, is_favourite, catalog_product:catalog_products(display_name, category, subcategory, image_url, image_ready)",
        )
        .eq("household_id", householdId)
        .eq("scope_type", "product")
        .eq("regular_buy", true),
      supabase
        .from("products")
        .select(
          "id, title, brand, image_url, is_favourite, catalog_product_id, catalog_product:catalog_products(display_name, category, subcategory, image_url, image_ready)",
        )
        .eq("household_id", householdId)
        .eq("is_regular_buy", true),
    ]);
    if (prefRes.error && productRes.error) return [];

    type CatalogJoin = {
      display_name: string;
      category: string;
      subcategory: string | null;
      image_url: string | null;
      image_ready: boolean;
    } | null;

    type Row = {
      scope_key: string;
      label: string;
      preferred_brand: string | null;
      brand_rigidity: string;
      is_favourite: boolean;
      catalog_product: CatalogJoin;
    };

    type ProductRow = {
      id: string;
      title: string;
      brand: string | null;
      image_url: string | null;
      is_favourite: boolean;
      catalog_product_id: string | null;
      catalog_product: CatalogJoin;
    };

    const prefRows = (prefRes.data ?? []) as unknown as Row[];
    const productRows = (productRes.data ?? []) as unknown as ProductRow[];

    const fromPreferences: RegularBuy[] = prefRows.map((row) => ({
      catalogProductId: row.scope_key,
      // The catalogue name wins when the row still points at a live product;
      // the stored label is the fallback for anything since removed.
      displayName: row.catalog_product?.display_name ?? row.label,
      category: row.catalog_product?.category ?? "Other",
      subcategory: row.catalog_product?.subcategory ?? null,
      imageUrl: row.catalog_product?.image_url ?? null,
      imageReady: row.catalog_product?.image_ready ?? false,
      preferredBrand: row.preferred_brand,
      brandRigidity: isBrandRigidity(row.brand_rigidity) ? row.brand_rigidity : "FLEXIBLE",
      isFavourite: row.is_favourite ?? false,
      productId: null,
    }));

    // A preference row is the richer record, so where both layers describe the
    // same concept the preference wins and the SKU is not listed twice.
    const covered = new Set(prefRows.map((r) => r.scope_key));
    const fromProducts: RegularBuy[] = productRows
      .filter((row) => !(row.catalog_product_id && covered.has(row.catalog_product_id)))
      .map((row) => ({
        catalogProductId: row.catalog_product_id ?? "",
        // Their own title, not the catalogue's: "Doritos Nacho Cheese" is what
        // they call it, and the whole point of these rows is the brand.
        displayName: row.title,
        category: row.catalog_product?.category ?? "Other",
        subcategory: row.catalog_product?.subcategory ?? null,
        // Their photograph first, the catalogue's only as a fallback.
        imageUrl: row.image_url ?? row.catalog_product?.image_url ?? null,
        imageReady: row.image_url ? true : (row.catalog_product?.image_ready ?? false),
        preferredBrand: row.brand,
        brandRigidity: "FLEXIBLE" as const,
        isFavourite: row.is_favourite ?? false,
        productId: row.id,
      }));

    return [...fromPreferences, ...fromProducts];
  } catch {
    return [];
  }
}

/** Just the ids, for marking products already tagged while browsing. */
export async function getRegularBuyIds(householdId: string | null): Promise<string[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("household_product_preferences")
      .select("scope_key")
      .eq("household_id", householdId)
      .eq("scope_type", "product")
      .eq("regular_buy", true);
    if (error || !data) return [];
    return (data as { scope_key: string }[]).map((r) => r.scope_key);
  } catch {
    return [];
  }
}

/**
 * The household's own branded products, shaped for the same search index.
 *
 * `id` is deliberately the catalogue id this product maps to, not the
 * `products` row id: every caller of the picker writes `product.id` into a
 * catalog_product_id column, and handing them a foreign key from the wrong
 * table would corrupt the data quietly. A product with no catalogue mapping is
 * left out rather than given an id that means something else.
 *
 * Household-scoped and never cached across households — unlike the shared
 * catalogue, this is one family's list of what they buy.
 */
export async function getHouseholdSearchProducts(householdId: string | null): Promise<CatalogProduct[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("title, brand, image_url, package_detail, catalog_product_id, catalog_product:catalog_products(category, subcategory, default_unit)")
      .eq("household_id", householdId)
      .not("catalog_product_id", "is", null);
    if (error || !data) return [];

    type Row = {
      title: string;
      brand: string | null;
      image_url: string | null;
      package_detail: string | null;
      catalog_product_id: string;
      catalog_product: { category: string; subcategory: string | null; default_unit: string | null } | null;
    };

    return (data as unknown as Row[]).map((row) => ({
      id: row.catalog_product_id,
      display_name: row.title,
      brand: row.brand,
      category: row.catalog_product?.category ?? "Other",
      subcategory: row.catalog_product?.subcategory ?? null,
      // The brand is already in display_name; repeating it as an alias would
      // double-count it in scoring for no gain.
      search_aliases: [],
      default_unit: row.package_detail ?? row.catalog_product?.default_unit ?? null,
      image_url: row.image_url,
      image_ready: !!row.image_url,
      preferred_store_hint: null,
      isHouseholdProduct: true,
    }));
  } catch {
    return [];
  }
}
