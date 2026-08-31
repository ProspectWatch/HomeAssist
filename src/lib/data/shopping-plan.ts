import { createClient } from "@/lib/supabase/server";
import { buildShoppingPlan, type NeedWithCandidates } from "@/lib/shopping/trip-optimizer";
import {
  getHouseholdPreferences,
  resolvePreferenceForCatalogProduct,
  type HouseholdProductPreference,
} from "@/lib/data/catalog";
import { buildProductCandidates } from "@/lib/retailers/ingestion";
import type { PriceObservationRecord } from "@/lib/retailers/types";
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
/** Most recent observation per (catalogue product, retailer). Append-only
 *  history stays intact; this only reads the current head of it. */
async function getRecentObservations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  catalogIds: string[],
): Promise<PriceObservationRecord[]> {
  const { data } = await supabase
    .from("retailer_price_observations")
    .select(
      "catalog_product_id, retailer_id, retailer_location_id, external_product_id, observed_price_cents, regular_price_cents, unit_price_text, package_size, unit, promotion_text, valid_from, valid_until, availability, source_url, source_type, match_confidence, match_method, match_status, raw_name, raw_brand, image_url, observed_at",
    )
    .in("catalog_product_id", catalogIds)
    .in("match_status", ["MATCHED", "LIKELY_MATCH"])
    .order("observed_at", { ascending: false })
    .limit(500);

  type Row = Record<string, unknown>;
  const seen = new Set<string>();
  const out: PriceObservationRecord[] = [];
  for (const row of (data ?? []) as Row[]) {
    const key = `${row.catalog_product_id}|${row.retailer_id}`;
    if (seen.has(key)) continue; // newest wins, ordered above
    seen.add(key);
    out.push({
      catalogProductId: row.catalog_product_id as string | null,
      retailerId: row.retailer_id as string,
      retailerLocationId: row.retailer_location_id as string | null,
      externalProductId: row.external_product_id as string | null,
      observedPriceCents: row.observed_price_cents as number,
      regularPriceCents: row.regular_price_cents as number | null,
      unitPriceText: row.unit_price_text as string | null,
      packageSize: row.package_size as string | null,
      unit: row.unit as string | null,
      promotionText: row.promotion_text as string | null,
      validFrom: row.valid_from as string | null,
      validUntil: row.valid_until as string | null,
      availability: row.availability as string | null,
      sourceUrl: row.source_url as string | null,
      sourceType: row.source_type as string,
      matchConfidence: row.match_confidence as number | null,
      matchMethod: row.match_method as string | null,
      matchStatus: row.match_status as PriceObservationRecord["matchStatus"],
      rawName: row.raw_name as string | null,
      rawBrand: row.raw_brand as string | null,
      imageUrl: (row.image_url as string | null) ?? null,
      observedAt: row.observed_at as string,
    });
  }
  return out;
}

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

    // Real retailer observations for exactly the products on this list.
    // Empty until a retailer adapter can legitimately reach live pricing —
    // buildShoppingPlan then honestly reports insufficient data rather than
    // inventing a plan.
    const catalogIds = rows.map((r) => r.catalog_product_id).filter((id): id is string => !!id);
    const observations = catalogIds.length > 0 ? await getRecentObservations(supabase, catalogIds) : [];
    const candidates = buildProductCandidates(observations);
    const candidatesByProduct = new Map<string, ReturnType<typeof buildProductCandidates>>();
    for (const candidate of candidates) {
      if (!candidate.catalogueProductId) continue;
      const bucket = candidatesByProduct.get(candidate.catalogueProductId) ?? [];
      bucket.push(candidate);
      candidatesByProduct.set(candidate.catalogueProductId, bucket);
    }
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
      // Only ever real, non-stale observations. No observations means no
      // candidates, which the engine reports honestly.
      return {
        need,
        candidates: row.catalog_product_id ? (candidatesByProduct.get(row.catalog_product_id) ?? []) : [],
      };
    });

    // Only retailers we actually observed a price from are in play.
    const retailerIds = [...new Set(candidates.map((c) => c.retailerId))];
    const { data: retailerRows } = await supabase.from("retailers").select("id, name").in("id", retailerIds);
    const retailers = ((retailerRows ?? []) as { id: string; name: string }[]).map((r) => ({
      id: r.id,
      name: r.name,
    }));
    return buildShoppingPlan({ items, retailers });
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

