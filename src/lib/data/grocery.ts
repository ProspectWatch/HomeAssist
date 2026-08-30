import { createClient } from "@/lib/supabase/server";
import { getHouseholdPreferences, resolvePreferenceForCatalogProduct } from "@/lib/data/catalog";

export type GroceryItem = {
  id: string;
  name: string;
  qty: string | null;
  category: "Meat" | "Dairy" | "Produce" | "Pantry" | "Frozen" | "Household" | "Other";
  checked: boolean;
  has_deal: boolean;
  retailer: { name: string } | null;
  /**
   * A real, non-fabricated signal: this item resolves (via
   * resolvePreferenceForCatalogProduct) to a household preference, so the
   * UI can show a "Preferred" hint. Null whenever no such preference
   * exists — never a guessed one. Recommended-retailer and deal-quality
   * badges are prepared for the same slot (see ShoppingRecommendation)
   * but stay unset until real price observations exist (Phase 2C scope).
   */
  preferredMatchLabel: string | null;
};

type GroceryRow = {
  id: string;
  name: string;
  qty: string | null;
  category: GroceryItem["category"];
  checked: boolean;
  has_deal: boolean;
  retailer: { name: string } | null;
  catalog_product_id: string | null;
  catalog_product: { category: string; subcategory: string | null } | null;
};

export async function getGroceryItems(householdId: string | null): Promise<GroceryItem[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const [{ data, error }, preferences] = await Promise.all([
      supabase
        .from("grocery_items")
        .select(
          "id, name, qty, category, checked, has_deal, retailer:retailers(name), catalog_product_id, catalog_product:catalog_products(category, subcategory)",
        )
        .eq("household_id", householdId)
        .order("created_at", { ascending: true }),
      getHouseholdPreferences(householdId),
    ]);
    if (error || !data) return [];

    return (data as unknown as GroceryRow[]).map((row) => {
      const pref =
        row.catalog_product && row.catalog_product_id
          ? resolvePreferenceForCatalogProduct(preferences, {
              id: row.catalog_product_id,
              category: row.catalog_product.category,
              subcategory: row.catalog_product.subcategory,
            })
          : null;
      return {
        id: row.id,
        name: row.name,
        qty: row.qty,
        category: row.category,
        checked: row.checked,
        has_deal: row.has_deal,
        retailer: row.retailer,
        preferredMatchLabel: pref
          ? [pref.preferred_brand, pref.preferred_variant].filter(Boolean).join(" · ") || pref.label
          : null,
      };
    });
  } catch {
    return [];
  }
}
