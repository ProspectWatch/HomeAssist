import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildAdapters } from "@/lib/retailers/registry";
import {
  buildScanTargets,
  scanAllRetailers,
  type RetailerScanOutcome,
  type ScanTarget,
} from "@/lib/retailers/ingestion";
import type { MatchableCatalogProduct } from "@/lib/retailers/matching";
import type { RetailLocationContext } from "@/lib/retailers/types";

/**
 * Server-only retailer ingestion.
 *
 * `server-only` is imported deliberately: this module talks to retailers and
 * writes price history, and must never be pulled into a client bundle (§23).
 * It uses the ordinary request-scoped Supabase client under RLS — no
 * service-role key is used or needed here.
 */

/** Builds the household's location anchor. Coordinates stay null unless real. */
export async function getLocationContext(householdId: string): Promise<RetailLocationContext> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_settings")
    .select("postal_code")
    .eq("household_id", householdId)
    .maybeSingle();

  return {
    postalCode: (data as { postal_code: string | null } | null)?.postal_code ?? "",
    // Never invented (§2). Populated only from a real geocoding source.
    latitude: null,
    longitude: null,
    radiusKm: null,
    preferredStoreLocationId: null,
    externalRetailerLocationId: null,
  };
}

/** Collects the household's scan targets in priority order (§11). */
export async function getScanTargets(householdId: string, limit = 25): Promise<ScanTarget[]> {
  const supabase = await createClient();

  const [listRes, inventoryRes, prefRes, watchRes, catalogRes] = await Promise.all([
    supabase
      .from("grocery_items")
      .select("catalog_product_id")
      .eq("household_id", householdId)
      .eq("checked", false)
      .not("catalog_product_id", "is", null),
    supabase
      .from("household_inventory_state")
      .select("catalog_product_id, status")
      .eq("household_id", householdId)
      .in("status", ["LOW", "OUT"]),
    supabase
      .from("household_product_preferences")
      .select("scope_key, regular_buy")
      .eq("household_id", householdId)
      .eq("scope_type", "product"),
    supabase
      .from("watch_items")
      .select("product:products(catalog_product_id)")
      .eq("household_id", householdId)
      .eq("status", "watching"),
    supabase.from("catalog_products").select("id, display_name").eq("active", true),
  ]);

  const namesById = new Map<string, string>();
  for (const row of (catalogRes.data ?? []) as { id: string; display_name: string }[]) {
    namesById.set(row.id, row.display_name);
  }

  const inventory = (inventoryRes.data ?? []) as { catalog_product_id: string; status: string }[];
  const prefs = (prefRes.data ?? []) as { scope_key: string; regular_buy: boolean }[];
  const watch = (watchRes.data ?? []) as { product: { catalog_product_id: string | null } | null }[];

  return buildScanTargets(
    {
      groceryListCatalogIds: ((listRes.data ?? []) as { catalog_product_id: string }[]).map(
        (r) => r.catalog_product_id,
      ),
      outCatalogIds: inventory.filter((r) => r.status === "OUT").map((r) => r.catalog_product_id),
      lowCatalogIds: inventory.filter((r) => r.status === "LOW").map((r) => r.catalog_product_id),
      regularBuyCatalogIds: prefs.filter((p) => p.regular_buy).map((p) => p.scope_key),
      preferenceCatalogIds: prefs.filter((p) => !p.regular_buy).map((p) => p.scope_key),
      watchCatalogIds: watch
        .map((w) => w.product?.catalog_product_id)
        .filter((id): id is string => !!id),
      recipeCatalogIds: [],
      namesById,
    },
    limit,
  );
}

async function getMatchableCatalog(): Promise<MatchableCatalogProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalog_products")
    .select("id, display_name, brand, category, subcategory, search_aliases, default_unit")
    .eq("active", true);
  return (data ?? []) as unknown as MatchableCatalogProduct[];
}

async function getRetailerIdsByName(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("retailers").select("id, name");
  const map = new Map<string, string>();
  for (const row of (data ?? []) as { id: string; name: string }[]) map.set(row.name, row.id);
  return map;
}

export type ScanRunResult = {
  overall: "COMPLETE" | "PARTIAL" | "FAILED";
  outcomes: RetailerScanOutcome[];
  targetsRequested: number;
  observationsStored: number;
};

/**
 * Runs a real scan for a household and persists what it observed.
 *
 * Each retailer gets its own scan_jobs row so a blocked retailer is recorded
 * as FAILED with its reason, while a working one still records COMPLETE and
 * keeps its results (§12, §18). Observations are inserted, never upserted over
 * history — the same-day/same-price unique index absorbs repeat sightings
 * without destroying the time series (§7).
 */
export async function runHouseholdScan(householdId: string): Promise<ScanRunResult> {
  const supabase = await createClient();
  const [targets, location, catalog, retailerIds] = await Promise.all([
    getScanTargets(householdId),
    getLocationContext(householdId),
    getMatchableCatalog(),
    getRetailerIdsByName(),
  ]);

  const adapters = buildAdapters(retailerIds);
  if (adapters.length === 0 || targets.length === 0) {
    return { overall: "FAILED", outcomes: [], targetsRequested: targets.length, observationsStored: 0 };
  }

  const { outcomes, overall } = await scanAllRetailers(adapters, targets, location, catalog);

  let observationsStored = 0;
  for (const outcome of outcomes) {
    const retailerId = retailerIds.get(outcome.retailerName) ?? null;

    if (outcome.status === "COMPLETE" && outcome.observations.length > 0) {
      const rows = outcome.observations.map((o) => ({
        catalog_product_id: o.catalogProductId,
        retailer_id: o.retailerId,
        retailer_location_id: o.retailerLocationId,
        external_product_id: o.externalProductId,
        observed_price_cents: o.observedPriceCents,
        regular_price_cents: o.regularPriceCents,
        unit_price_text: o.unitPriceText,
        package_size: o.packageSize,
        unit: o.unit,
        promotion_text: o.promotionText,
        valid_from: o.validFrom,
        valid_until: o.validUntil,
        availability: o.availability,
        source_url: o.sourceUrl,
        source_type: o.sourceType,
        match_confidence: o.matchConfidence,
        match_method: o.matchMethod,
        match_status: o.matchStatus,
        raw_name: o.rawName,
        raw_brand: o.rawBrand,
        observed_at: o.observedAt,
      }));
      // ignoreDuplicates: a repeat sighting of the same price today is not new
      // information, but it must not fail the scan either.
      const { error } = await supabase
        .from("retailer_price_observations")
        .upsert(rows, { ignoreDuplicates: true });
      if (!error) observationsStored += rows.length;
    }

    await supabase.from("scan_jobs").insert({
      household_id: householdId,
      retailer_id: retailerId,
      status: outcome.status === "COMPLETE" ? "COMPLETE" : "FAILED",
      trigger: "manual",
      source: `adapter:${outcome.retailerKey}`,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      targets_requested: outcome.targetsRequested,
      targets_matched: outcome.status === "COMPLETE" ? outcome.targetsMatched : 0,
      prices_found: outcome.status === "COMPLETE" ? outcome.observations.length : 0,
      products_scanned: outcome.status === "COMPLETE" ? outcome.observations.length : 0,
      error: outcome.status === "FAILED" ? `${outcome.reason}: ${outcome.message}` : null,
    });
  }

  return { overall, outcomes, targetsRequested: targets.length, observationsStored };
}
