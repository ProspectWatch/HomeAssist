import { classifyFreshness } from "./freshness";
import { parsePackageSize, parsePriceToCents } from "./normalization";
import { matchToCatalog, type MatchableCatalogProduct } from "./matching";
import {
  AdapterError,
  type AdapterFailureReason,
  type CatalogMatch,
  type PriceObservationRecord,
  type RetailerAdapter,
  type RetailerProductRaw,
  type RetailLocationContext,
} from "./types";
import type { ProductCandidate } from "@/lib/shopping/types";

/** Why a catalogue product is worth scanning, highest priority first (§11). */
export type ScanTargetReason =
  | "GROCERY_LIST"
  | "OUT"
  | "LOW"
  | "REGULAR_BUY"
  | "PREFERENCE"
  | "WATCH"
  | "RECIPE";

export const SCAN_TARGET_PRIORITY: ScanTargetReason[] = [
  "GROCERY_LIST",
  "OUT",
  "LOW",
  "REGULAR_BUY",
  "PREFERENCE",
  "WATCH",
  "RECIPE",
];

export type ScanTarget = {
  catalogProductId: string;
  /** What to search the retailer for — the catalogue's own display name. */
  query: string;
  reason: ScanTargetReason;
};

export type ScanTargetInputs = {
  groceryListCatalogIds: string[];
  outCatalogIds: string[];
  lowCatalogIds: string[];
  regularBuyCatalogIds: string[];
  preferenceCatalogIds: string[];
  watchCatalogIds: string[];
  recipeCatalogIds: string[];
  /** catalogProductId -> display name, for building the search query. */
  namesById: Map<string, string>;
};

/**
 * Builds the deduplicated, priority-ordered scan list for a household.
 *
 * Targeted by design: this never asks a retailer for its whole catalogue, only
 * for the handful of products this household actually cares about right now
 * (§11, §22). A product appearing in several buckets keeps its highest-priority
 * reason and is scanned once.
 */
export function buildScanTargets(inputs: ScanTargetInputs, limit = 50): ScanTarget[] {
  const buckets: [ScanTargetReason, string[]][] = [
    ["GROCERY_LIST", inputs.groceryListCatalogIds],
    ["OUT", inputs.outCatalogIds],
    ["LOW", inputs.lowCatalogIds],
    ["REGULAR_BUY", inputs.regularBuyCatalogIds],
    ["PREFERENCE", inputs.preferenceCatalogIds],
    ["WATCH", inputs.watchCatalogIds],
    ["RECIPE", inputs.recipeCatalogIds],
  ];

  const seen = new Set<string>();
  const targets: ScanTarget[] = [];
  for (const [reason, ids] of buckets) {
    for (const id of ids) {
      if (seen.has(id)) continue;
      const query = inputs.namesById.get(id);
      if (!query) continue; // never scan for a product we can't name
      seen.add(id);
      targets.push({ catalogProductId: id, query, reason });
      if (targets.length >= limit) return targets;
    }
  }
  return targets;
}

export type RetailerScanOutcome =
  | {
      status: "COMPLETE";
      retailerKey: string;
      retailerName: string;
      targetsRequested: number;
      targetsMatched: number;
      observations: PriceObservationRecord[];
      reviewQueue: { raw: RetailerProductRaw; match: CatalogMatch }[];
    }
  | {
      status: "FAILED";
      retailerKey: string;
      retailerName: string;
      targetsRequested: number;
      reason: AdapterFailureReason;
      message: string;
      detail?: string;
    };

function toObservation(
  raw: RetailerProductRaw,
  match: CatalogMatch,
  sourceType: string,
): PriceObservationRecord | null {
  // No price, no observation. A product listing without a price is not a
  // price observation and must never be recorded as one.
  if (raw.currentPriceCents == null) return null;
  return {
    catalogProductId: match.catalogProductId,
    retailerId: raw.retailerId,
    retailerLocationId: raw.retailerLocationId,
    externalProductId: raw.externalProductId,
    observedPriceCents: raw.currentPriceCents,
    regularPriceCents: raw.regularPriceCents ?? null,
    unitPriceText: raw.unitPriceText ?? null,
    packageSize: raw.packageSize ?? null,
    unit: raw.unit ?? null,
    promotionText: raw.promotionText ?? null,
    validFrom: raw.promotionStart ?? null,
    validUntil: raw.promotionEnd ?? null,
    availability: raw.availability ?? null,
    sourceUrl: raw.url,
    sourceType,
    matchConfidence: match.confidence,
    matchMethod: match.matchMethod,
    matchStatus: match.status,
    rawName: raw.name,
    rawBrand: raw.brand,
    observedAt: raw.observedAt,
  };
}

/** Small delay between requests — deliberate politeness, not throughput (§22). */
const REQUEST_DELAY_MS = 400;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Scans one retailer for a household's targets.
 *
 * Failure is contained here: if this retailer is blocked or errors, the caller
 * still gets every other retailer's results, and this one is reported as
 * unavailable rather than as an absence of deals (§18).
 */
export async function scanRetailer(
  adapter: RetailerAdapter,
  targets: ScanTarget[],
  location: RetailLocationContext,
  catalog: MatchableCatalogProduct[],
): Promise<RetailerScanOutcome> {
  const observations: PriceObservationRecord[] = [];
  const reviewQueue: { raw: RetailerProductRaw; match: CatalogMatch }[] = [];
  const matchedTargets = new Set<string>();

  try {
    for (const [index, target] of targets.entries()) {
      if (index > 0) await sleep(REQUEST_DELAY_MS);
      const results = await adapter.searchProducts(target.query, location);

      // Only consider the top handful — this is a lookup, not a crawl.
      for (const raw of results.slice(0, 5)) {
        const match = matchToCatalog(raw, catalog);
        if (match.status === "REVIEW_REQUIRED" || match.status === "UNMATCHED") {
          reviewQueue.push({ raw, match });
          continue;
        }
        const observation = toObservation(raw, match, `adapter:${adapter.key}`);
        if (!observation) continue;
        observations.push(observation);
        if (match.catalogProductId) matchedTargets.add(match.catalogProductId);
      }
    }

    return {
      status: "COMPLETE",
      retailerKey: adapter.key,
      retailerName: adapter.retailerName,
      targetsRequested: targets.length,
      targetsMatched: matchedTargets.size,
      observations,
      reviewQueue,
    };
  } catch (err) {
    const adapterError =
      err instanceof AdapterError
        ? err
        : new AdapterError("UNKNOWN", err instanceof Error ? err.message : "Scan failed.");
    return {
      status: "FAILED",
      retailerKey: adapter.key,
      retailerName: adapter.retailerName,
      targetsRequested: targets.length,
      reason: adapterError.reason,
      message: adapterError.message,
      detail: adapterError.detail,
    };
  }
}

/**
 * Runs every retailer independently and never lets one failure hide another's
 * results. Retailers are scanned sequentially — one household's shopping list
 * does not justify parallel load on a grocery chain.
 */
export async function scanAllRetailers(
  adapters: RetailerAdapter[],
  targets: ScanTarget[],
  location: RetailLocationContext,
  catalog: MatchableCatalogProduct[],
): Promise<{ outcomes: RetailerScanOutcome[]; overall: "COMPLETE" | "PARTIAL" | "FAILED" }> {
  const outcomes: RetailerScanOutcome[] = [];
  for (const adapter of adapters) {
    outcomes.push(await scanRetailer(adapter, targets, location, catalog));
  }
  const succeeded = outcomes.filter((o) => o.status === "COMPLETE").length;
  const overall = succeeded === 0 ? "FAILED" : succeeded === outcomes.length ? "COMPLETE" : "PARTIAL";
  return { outcomes, overall };
}

/** "$1.99 / 100g" -> 199. Null when the retailer gave nothing parseable. */
function parseUnitPriceCents(unitPriceText: string | null): number | null {
  if (!unitPriceText) return null;
  return parsePriceToCents(unitPriceText.split("/")[0] ?? null);
}

/**
 * Adapts stored observations into the Phase 2C ProductCandidate contract.
 *
 * The retailer layer bends to the existing engine, not the other way round:
 * ProductCandidate is untouched. Observations with no catalogue identity, or
 * whose price is too old to state as current, are excluded rather than fed in
 * with a caveat the engine can't see.
 */
export function buildProductCandidates(
  observations: PriceObservationRecord[],
  options: { now?: Date } = {},
): ProductCandidate[] {
  const now = options.now ?? new Date();
  return observations
    .filter((o) => o.catalogProductId !== null)
    .filter((o) => classifyFreshness(o.observedAt, now) !== "STALE")
    .map((o) => {
      const size = parsePackageSize(o.packageSize);
      return {
        catalogueProductId: o.catalogProductId,
        retailerId: o.retailerId,
        retailerProductId: o.externalProductId,
        retailerProductName: o.rawName ?? "",
        brand: o.rawBrand,
        // The retailer layer does not infer variants; the preference layer
        // owns variant semantics (§6).
        variant: null,
        packageSize: o.packageSize,
        quantity: size.quantity ?? 1,
        priceCents: o.observedPriceCents,
        unitPriceCents: parseUnitPriceCents(o.unitPriceText),
        // Deliberately neutral: how well this suits THIS household is decided
        // by matchCandidate() against household preferences (§6). The retailer
        // layer must not pre-judge it.
        matchQuality: "ACCEPTABLE" as const,
      };
    });
}
