import "server-only";

import { createClient } from "@/lib/supabase/server";
import { offerKey, searchFlyerDeals, type FlyerDeal } from "@/lib/retailers/flyers/flipp";
import { buildFlyerObservations, type FlyerIngestSummary } from "@/lib/retailers/flyers/deals";
import type { KnownRetailer } from "@/lib/retailers/flyers/merchants";
import type { MatchableCatalogProduct } from "@/lib/retailers/matching";
import { AdapterError } from "@/lib/retailers/types";
import { getLocationContext, getScanTargets } from "@/lib/data/retailer-scan";
import type { ScanTarget } from "@/lib/retailers/ingestion";

/**
 * Weekly-flyer deal scanning.
 *
 * `server-only`: this reaches an external service and writes price history,
 * and must never be pulled into a client bundle. It runs under the ordinary
 * request-scoped Supabase client and RLS — no service-role key.
 *
 * Deliberately targeted rather than exhaustive: it searches for the handful
 * of products the household actually cares about right now (its list, what's
 * out or low, its regular buys), never for a whole catalogue. Requests go out
 * in small batches with a pause between them, because this app serves one
 * household and must not behave like a crawler.
 */

/** How many products one scan will look up. Enough to cover a week's list and
 *  the regular buys that matter, small enough to stay a polite guest. */
const MAX_TARGETS = 30;
/** Requests in flight at once. */
const BATCH_SIZE = 6;
/** Pause between batches. */
const BATCH_PAUSE_MS = 400;

export type FlyerScanResult =
  | ({
      status: "COMPLETE";
      targetsRequested: number;
      /** Everything the household would like checked, of which
       *  `targetsRequested` were reached this run. */
      totalTargets: number;
      stored: number;
    } & FlyerIngestSummary)
  | { status: "FAILED"; reason: string; message: string; targetsRequested: number };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getRetailers(): Promise<KnownRetailer[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("retailers").select("id, name");
  return ((data ?? []) as KnownRetailer[]).filter((r) => r.id && r.name);
}

async function getMatchableCatalog(): Promise<MatchableCatalogProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalog_products")
    .select("id, display_name, brand, category, subcategory, search_aliases, default_unit")
    .eq("active", true);
  return (data ?? []) as unknown as MatchableCatalogProduct[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Searches every target, in small batches.
 *
 * A single failed lookup does not fail the scan — one product's search going
 * wrong shouldn't discard the deals found for the other fourteen. But if
 * *every* lookup fails, that's a real outage and it is reported as one rather
 * than as "no deals found today".
 */
async function collectDeals(
  terms: string[],
  postalCode: string,
): Promise<{ deals: FlyerDeal[]; failures: number; lastError: AdapterError | null }> {
  const deals: FlyerDeal[] = [];
  let failures = 0;
  let lastError: AdapterError | null = null;

  for (let i = 0; i < terms.length; i += BATCH_SIZE) {
    const batch = terms.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (term) => {
        try {
          return await searchFlyerDeals(term, postalCode);
        } catch (error) {
          failures++;
          if (error instanceof AdapterError) lastError = error;
          return [];
        }
      }),
    );
    for (const result of results) deals.push(...result);
    if (i + BATCH_SIZE < terms.length) await sleep(BATCH_PAUSE_MS);
  }

  return { deals, failures, lastError };
}

/**
 * Collapses repeats of the same offer.
 *
 * Keyed on the offer itself — store, wording, price, window — and
 * deliberately not on the flyer item id: a chain runs the same ad as several
 * items across its flyer, so "CARROTS $1.44 at Food Basics" came back three
 * times with three ids. Those are one deal.
 */
function dedupe(deals: FlyerDeal[]): FlyerDeal[] {
  const seen = new Set<string>();
  const out: FlyerDeal[] = [];
  for (const deal of deals) {
    const key = offerKey(deal);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(deal);
  }
  return out;
}

/**
 * Orders targets so a scan covers ground it hasn't covered lately.
 *
 * A household with 146 regular buys can't have all of them searched in one
 * request, and always scanning the same first thirty would leave the rest
 * permanently unchecked. Products with no flyer observation yet go first,
 * then the ones checked longest ago.
 */
async function rotateByStaleness(targets: ScanTarget[]): Promise<ScanTarget[]> {
  if (targets.length <= MAX_TARGETS) return targets;
  const supabase = await createClient();
  const { data } = await supabase
    .from("retailer_price_observations")
    .select("catalog_product_id, observed_at")
    .eq("source_type", "FLYER")
    .in("catalog_product_id", targets.map((t) => t.catalogProductId))
    .order("observed_at", { ascending: false });

  const lastSeen = new Map<string, string>();
  for (const row of (data ?? []) as { catalog_product_id: string | null; observed_at: string }[]) {
    if (row.catalog_product_id && !lastSeen.has(row.catalog_product_id)) {
      lastSeen.set(row.catalog_product_id, row.observed_at);
    }
  }

  // Stable sort: never-searched first, then oldest first. Priority order from
  // buildScanTargets survives within each staleness group.
  return [...targets].sort((a, b) => {
    const aSeen = lastSeen.get(a.catalogProductId) ?? "";
    const bSeen = lastSeen.get(b.catalogProductId) ?? "";
    return aSeen < bSeen ? -1 : aSeen > bSeen ? 1 : 0;
  });
}

export async function runFlyerScan(householdId: string): Promise<FlyerScanResult> {
  const supabase = await createClient();
  const [allTargets, location, retailers, catalog] = await Promise.all([
    // Pulled wide, then narrowed by staleness below, so successive scans
    // work through the whole list instead of re-checking the same head.
    getScanTargets(householdId, 300),
    getLocationContext(householdId),
    getRetailers(),
    getMatchableCatalog(),
  ]);

  const targets = (await rotateByStaleness(allTargets)).slice(0, MAX_TARGETS);
  const startedAt = new Date().toISOString();

  const finish = async (result: FlyerScanResult) => {
    await supabase.from("scan_jobs").insert({
      household_id: householdId,
      status: result.status === "COMPLETE" ? "COMPLETE" : "FAILED",
      trigger: "manual",
      source: "flyer:flipp",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      targets_requested: result.targetsRequested,
      targets_matched: result.status === "COMPLETE" ? result.observations.length : 0,
      prices_found: result.status === "COMPLETE" ? result.stored : 0,
      products_scanned: result.status === "COMPLETE" ? result.observations.length : 0,
      error: result.status === "FAILED" ? `${result.reason}: ${result.message}` : null,
    });
    return result;
  };

  if (!location.postalCode) {
    return finish({
      status: "FAILED",
      reason: "NOT_CONFIGURED",
      message: "Add your postal code in Settings so we know which flyers apply.",
      targetsRequested: 0,
    });
  }
  if (targets.length === 0) {
    return finish({
      status: "FAILED",
      reason: "NOT_CONFIGURED",
      message: "Nothing to search for — tag some regular buys or add items to your list first.",
      targetsRequested: 0,
    });
  }

  const { deals, failures, lastError } = await collectDeals(
    targets.map((t) => t.query),
    location.postalCode,
  );

  if (failures === targets.length) {
    return finish({
      status: "FAILED",
      reason: lastError?.reason ?? "UNKNOWN",
      message: lastError?.message ?? "Flyer search is unavailable right now.",
      targetsRequested: targets.length,
    });
  }

  const observedAt = new Date().toISOString();
  const summary = buildFlyerObservations({
    deals: dedupe(deals),
    retailers,
    catalog,
    today: todayISO(),
    observedAt,
  });

  let stored = 0;
  if (summary.observations.length > 0) {
    const rows = summary.observations.map((o) => ({
      household_id: householdId,
      catalog_product_id: o.catalogProductId,
      retailer_id: o.retailerId,
      external_product_id: o.externalProductId,
      observed_price_cents: o.observedPriceCents,
      regular_price_cents: o.regularPriceCents,
      package_size: o.packageSize,
      unit: o.unit,
      promotion_text: o.promotionText,
      valid_from: o.validFrom,
      valid_until: o.validUntil,
      source_url: o.sourceUrl,
      source_type: o.sourceType,
      match_confidence: o.matchConfidence,
      match_method: o.matchMethod,
      match_status: o.matchStatus,
      raw_name: o.rawName,
      observed_at: o.observedAt,
    }));
    // Collapse anything that would land on the same unique-index key before
    // it reaches Postgres, so one statement never carries two rows the index
    // considers identical.
    const byIndexKey = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = [
        row.retailer_id,
        row.external_product_id ?? "",
        row.catalog_product_id ?? "",
        row.observed_price_cents,
        row.observed_at.slice(0, 10),
      ].join("|");
      if (!byIndexKey.has(key)) byIndexKey.set(key, row);
    }
    const unique = [...byIndexKey.values()];

    // A repeat sighting of the same advertised price today is not new
    // information, but it must not fail the scan either.
    const { error } = await supabase
      .from("retailer_price_observations")
      .upsert(unique, { ignoreDuplicates: true });
    if (error) {
      return finish({
        status: "FAILED",
        reason: "UNKNOWN",
        message: error.message,
        targetsRequested: targets.length,
      });
    }
    stored = unique.length;
  }

  return finish({
    status: "COMPLETE",
    targetsRequested: targets.length,
    totalTargets: allTargets.length,
    stored,
    ...summary,
  });
}
