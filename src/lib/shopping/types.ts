/**
 * Shopping Intelligence domain model (Phase 2C).
 *
 * Core principle: HomeAssist does not choose the cheapest SKU in isolation.
 * It chooses the best HOUSEHOLD SHOPPING PLAN — weighing product/brand/
 * variant preference, price (unit/current/historical), preferred retailer,
 * trip convenience (is the household already going there?), aggregate
 * savings across the whole list, urgency, and stock-up practicality.
 *
 * This file is pure data shape — no I/O, no Supabase, no fabricated data.
 * Nothing in here is populated from real retailer prices yet; that's a
 * later phase. `buildShoppingPlan()` (trip-optimizer.ts) is the only thing
 * that turns these into a recommendation, and it is explicit about
 * insufficient data rather than ever inventing a number.
 */

/** A brand-rigidity policy, mirrored from household_product_preferences. */
export type BrandRigidity = "EXACT_ONLY" | "PREFERRED" | "FLEXIBLE";

/** How closely a retailer's actual product matches what the household needs. */
export type MatchQuality = "EXACT" | "VERY_CLOSE" | "ACCEPTABLE" | "LAST_RESORT";

/**
 * How good a price is, relative to this household's own history and
 * targets — never relative to some invented "market average". Every
 * classifier that produces one of these must be able to point at the real
 * PriceObservation(s) and (when relevant) target price it used.
 */
export type DealQuality =
  | "NORMAL"
  | "DECENT_DEAL"
  | "GOOD_BUY"
  | "GREAT_BUY"
  | "STOCK_UP"
  | "TARGET_HIT"
  | "ALL_TIME_LOW";

/**
 * A household's need for a product — the demand side of the engine. Not
 * itself a retailer SKU: a ProductNeed for "milk" might resolve to several
 * different ProductCandidates depending on where you'd buy it.
 */
export interface ProductNeed {
  /** catalog_products.id, when the need maps to the generic catalogue. */
  catalogueProductId: string | null;
  /** Free-text name — always present, even for a custom (non-catalogue) item. */
  name: string;
  /** e.g. "2 lb", "1 bag" — how much the household wants, if known. */
  quantity: string | null;
  /** Household's resolved preference for this need, if one exists (see
   *  resolvePreferenceForCatalogProduct in lib/data/catalog.ts). */
  preference: {
    preferredBrand: string | null;
    preferredVariant: string | null;
    preferredSize: string | null;
    preferredStoreId: string | null;
    acceptableBrands: string[];
    acceptableStores: string[];
    brandRigidity: BrandRigidity;
  } | null;
  /** How soon the household needs this — affects whether a special trip
   *  is worth it (an urgent need justifies more than a routine one). */
  urgency: "routine" | "needed_soon" | "urgent";
  /** Optional target price the household set (watch_items.target_price_cents). */
  targetPriceCents: number | null;
}

/**
 * One retailer's actual product that could satisfy a ProductNeed. This is
 * the thing a future scan/scrape pipeline will produce many of per need;
 * today nothing populates these except tests.
 */
export interface ProductCandidate {
  catalogueProductId: string | null;
  retailerId: string;
  retailerProductId: string | null;
  retailerProductName: string;
  brand: string | null;
  variant: string | null;
  packageSize: string | null;
  quantity: number;
  priceCents: number;
  /** Price per standard unit (per kg, per L, per 100 units...), when computable. */
  unitPriceCents: number | null;
  matchQuality: MatchQuality;
}

/**
 * The resolved pairing of a need to the specific candidate the engine is
 * proposing — the thing a recommendation is actually built from.
 */
export interface ProductMatch {
  need: ProductNeed;
  candidate: ProductCandidate;
  matchQuality: MatchQuality;
  /** Short human-readable note on *why* this is the match quality it is,
   *  e.g. "Exact brand match" or "No preference set — closest generic fit". */
  matchReason: string;
}

/**
 * A single real price sighting for a product at a retailer. Never
 * fabricated — every field traces back to a real scan, receipt, or manual
 * entry (see `source`); an empty PriceObservation[] is the honest default
 * until that pipeline exists.
 */
export interface PriceObservation {
  catalogueProductId: string | null;
  retailerId: string;
  observedPriceCents: number;
  /** The retailer's own non-promotional price, if known/different. */
  regularPriceCents: number | null;
  unitPriceCents: number | null;
  promotionText: string | null;
  observedAt: string;
  /** Promotion validity window, if this observation is a flyer/promo price. */
  validFrom: string | null;
  validUntil: string | null;
  source: "scan" | "manual" | "receipt";
  /** 0–1: how much to trust this observation (a receipt is higher
   *  confidence than an old scan; confidence decays with the observation's age). */
  confidence: number;
}

/** A store stop that is already happening this trip, independent of any
 *  item this engine is currently deciding — the whole reason "we're
 *  already going to Fortinos" changes the recommendation. */
export interface StoreVisit {
  retailerId: string;
  /** Why this stop already exists: the household planned it, or another
   *  item in this same shopping run already put it on the map. */
  reason: "planned" | "added_by_plan";
  /** Optional trip-cost context — never required (route optimization is
   *  a later phase; these are just inputs the engine may weigh). */
  distanceKm: number | null;
  driveTimeMinutes: number | null;
}

/** The full set of stops the plan proposes for this shopping run. */
export interface ShoppingTrip {
  visits: StoreVisit[];
  /** Every ProductMatch this trip's stops collectively cover. */
  matches: ProductMatch[];
  estimatedTotalCents: number;
}

/**
 * The engine's output for a single ProductNeed: where to buy it, and why.
 * `dealQuality`/`confidence` are honest about missing data — see
 * classifyDeal() in deal-quality.ts.
 */
export interface ShoppingRecommendation {
  need: ProductNeed;
  /** Null when there isn't enough data to recommend anything yet. */
  recommendedCandidate: ProductCandidate | null;
  recommendedRetailerId: string | null;
  recommendedPriceCents: number | null;
  unitPriceCents: number | null;
  matchQuality: MatchQuality | null;
  /** Null (not "NORMAL") when there isn't enough price history to classify. */
  dealQuality: DealQuality | null;
  /** Always present, always human-readable, always honest — e.g.
   *  "Same price as Food Basics and you're already going to Fortinos." or
   *  "No price data yet for this item." */
  reason: string;
  /** Other candidates considered, most-relevant first (for a "compare" UI later). */
  otherOptions: ProductCandidate[];
  /** How this recommendation affects the trip: does it require a new stop? */
  tripImpact: {
    requiresNewStop: boolean;
    addedRetailerId: string | null;
    /** Only meaningful when requiresNewStop — the savings that justified it. */
    aggregateSavingsCentsIfAdded: number | null;
  };
  historicalContext: {
    hasHistory: boolean;
    lowestObservedPriceCents: number | null;
    isAllTimeLow: boolean;
  };
  /** 0–1: confidence in this recommendation. Low/zero confidence must
   *  correspond to a `reason` that says so — never a confident-sounding
   *  reason paired with a low number. */
  confidence: number;
}

/** The verdict on a single price: how good is it, and can we tell? */
export interface DealAssessment {
  quality: DealQuality | null;
  /** False whenever `quality` is null — the two must agree. */
  hasSufficientData: boolean;
  reason: string;
  targetPriceHit: boolean;
  isAllTimeLow: boolean;
}

/** The engine's output for a whole shopping list — what buildShoppingPlan() returns. */
export interface ShoppingPlanResult {
  status: "ready" | "insufficient_data" | "empty";
  /** Always a truthful, user-facing sentence — this is what the Home
   *  screen's "This Week's Shopping Plan" card renders. */
  summary: string;
  trips: ShoppingTrip[];
  recommendations: ShoppingRecommendation[];
  estimatedSpendCents: number | null;
  estimatedSavingsCents: number | null;
  avoidedStops: { retailerId: string; reason: string }[];
}
