import { createClient } from "@/lib/supabase/server";
import { buildShoppingPlan, type NeedWithCandidates } from "@/lib/shopping/trip-optimizer";
import {
  getHouseholdPreferences,
  resolvePreferenceForCatalogProduct,
  type HouseholdProductPreference,
} from "@/lib/data/catalog";
import type { ProductNeed, ShoppingPlanResult } from "@/lib/shopping/types";

type GroceryRow = {
  id: string;
  name: string;
  qty: string | null;
  catalog_product_id: string | null;
  catalog_product: { category: string; subcategory: string | null } | null;
};

function toPreferenceInput(pref: HouseholdProductPreference): ProductNeed["preference"] {
  return {
    preferredBrand: pref.preferred_brand,
    preferredVariant: pref.preferred_variant,
    preferredSize: pref.preferred_size,
    preferredStoreId: null, // preferred_store is a free-text hint today; retailer-id resolution lands with live pricing.
    acceptableBrands: pref.acceptable_brands,
    acceptableStores: pref.acceptable_stores,
    brandRigidity: pref.brand_rigidity,
  };
}

/**
 * Builds This Week's Shopping Plan from the household's real, unchecked
 * grocery list and real preferences — but with zero price observations,
 * since no retailer scanning exists yet (Phase 2C scope). The result is
 * always honest: `buildShoppingPlan` returns `insufficient_data`/`empty`
 * rather than a fabricated plan whenever there's nothing to price against.
 */
export async function getHomeShoppingPlan(householdId: string | null): Promise<ShoppingPlanResult> {
  if (!householdId) {
    return {
      status: "empty",
      summary: "Add items to your grocery list to build this week's plan.",
      trips: [],
      recommendations: [],
      estimatedSpendCents: null,
      estimatedSavingsCents: null,
      avoidedStops: [],
    };
  }

  try {
    const supabase = await createClient();
    const [groceryRes, preferences] = await Promise.all([
      supabase
        .from("grocery_items")
        .select("id, name, qty, catalog_product_id, catalog_product:catalog_products(category, subcategory)")
        .eq("household_id", householdId)
        .eq("checked", false),
      getHouseholdPreferences(householdId),
    ]);

    const rows = (groceryRes.data ?? []) as unknown as GroceryRow[];
    const items: NeedWithCandidates[] = rows.map((row) => {
      const pref = row.catalog_product
        ? resolvePreferenceForCatalogProduct(preferences, {
            id: row.catalog_product_id!,
            category: row.catalog_product.category,
            subcategory: row.catalog_product.subcategory,
          })
        : null;
      const need: ProductNeed = {
        catalogueProductId: row.catalog_product_id,
        name: row.name,
        quantity: row.qty,
        preference: pref ? toPreferenceInput(pref) : null,
        urgency: "routine",
        targetPriceCents: null,
      };
      // No retailer scanning yet — every need has zero real candidates.
      return { need, candidates: [] };
    });

    return buildShoppingPlan({ items, retailers: [] });
  } catch {
    return {
      status: "empty",
      summary: "Add items to your grocery list to build this week's plan.",
      trips: [],
      recommendations: [],
      estimatedSpendCents: null,
      estimatedSavingsCents: null,
      avoidedStops: [],
    };
  }
}

