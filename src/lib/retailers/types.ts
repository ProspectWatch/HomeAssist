/**
 * Retailer ingestion contracts.
 *
 * This layer answers exactly one question: "what product is this, and what
 * price did we observe?" It never decides whether the household should buy
 * something or where — that stays in the Phase 2C shopping engine, which
 * consumes ProductCandidate. Nothing in here imports from src/lib/shopping
 * except to satisfy that outbound contract.
 */

/** Where a scan is being run for. Coordinates stay null until they come from
 *  a real geocoding source — the postal code is the anchor until then. */
export type RetailLocationContext = {
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
  preferredStoreLocationId: string | null;
  externalRetailerLocationId: string | null;
};

/** A store as the retailer describes it. Only ever built from real data. */
export type RetailerLocation = {
  externalLocationId: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

/**
 * A product exactly as a retailer exposed it, before any HomeAssist opinion
 * is applied. rawPayload is retained for provenance and debugging so a
 * questionable match can always be traced back to what the retailer actually
 * returned.
 */
export type RetailerProductRaw = {
  retailerId: string;
  retailerLocationId: string | null;
  externalProductId: string;
  url: string | null;
  name: string;
  brand: string | null;
  description?: string | null;
  category?: string | null;
  packageSize?: string | null;
  unit?: string | null;
  /** Cents. The price actually being charged right now. */
  currentPriceCents?: number | null;
  /** Cents. The non-promotional price, when the retailer exposes it. */
  regularPriceCents?: number | null;
  unitPriceText?: string | null;
  promotionText?: string | null;
  promotionStart?: string | null;
  promotionEnd?: string | null;
  availability?: string | null;
  imageUrl?: string | null;
  rawPayload?: unknown;
  observedAt: string;
};

export type MatchStatus = "MATCHED" | "LIKELY_MATCH" | "REVIEW_REQUIRED" | "UNMATCHED";

export type MatchMethod =
  | "external_id"
  | "brand_and_name"
  | "alias"
  | "normalized_name"
  | "token_overlap"
  | "none";

export type CatalogMatch = {
  catalogProductId: string | null;
  /** 0..1. Thresholds live in matching.ts, not in adapters. */
  confidence: number;
  matchMethod: MatchMethod;
  status: MatchStatus;
  /** Human-readable why, kept for the review queue. */
  reason: string;
};

/** A stored observation, as the rest of the app reads it back. */
export type PriceObservationRecord = {
  catalogProductId: string | null;
  retailerId: string;
  retailerLocationId: string | null;
  externalProductId: string | null;
  observedPriceCents: number;
  regularPriceCents: number | null;
  unitPriceText: string | null;
  packageSize: string | null;
  unit: string | null;
  promotionText: string | null;
  validFrom: string | null;
  validUntil: string | null;
  availability: string | null;
  sourceUrl: string | null;
  sourceType: string;
  matchConfidence: number | null;
  matchMethod: string | null;
  matchStatus: MatchStatus;
  rawName: string | null;
  rawBrand: string | null;
  /** Picture from the flyer or listing. Stands in when the catalogue product
   *  has no photograph of its own. */
  imageUrl: string | null;
  observedAt: string;
};

/** Why an adapter could not return data. Surfaced honestly rather than as zero prices. */
export type AdapterFailureReason =
  | "ACCESS_BLOCKED"
  | "NETWORK_ERROR"
  | "RATE_LIMITED"
  | "PARSE_ERROR"
  | "NOT_CONFIGURED"
  | "UNKNOWN";

export class AdapterError extends Error {
  constructor(
    readonly reason: AdapterFailureReason,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

/**
 * Every retailer implements this. HomeAssist only ever talks to retailers
 * through it, so no retailer-specific payload shape leaks into the rest of
 * the app and a new banner is a new file rather than a new code path.
 */
export type RetailerAdapter = {
  /** Slug used in config and logs (e.g. "fortinos"). */
  key: string;
  /** retailers.name, resolved to retailers.id at runtime. */
  retailerName: string;
  /** Search the retailer for a household need. */
  searchProducts(query: string, location: RetailLocationContext): Promise<RetailerProductRaw[]>;
  /** Fetch one known product by the retailer's own id or URL. */
  fetchProduct(externalIdOrUrl: string, location: RetailLocationContext): Promise<RetailerProductRaw | null>;
  /** Optional: a retailer's current flyer/promotions, where publicly exposed. */
  fetchDeals?(location: RetailLocationContext): Promise<RetailerProductRaw[]>;
  /** Optional: the retailer's real store list for a location context. */
  fetchLocations?(location: RetailLocationContext): Promise<RetailerLocation[]>;
};
