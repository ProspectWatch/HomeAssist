import { matchToCatalog, type MatchableCatalogProduct } from "../matching";
import type { PriceSourceType } from "../source-types";
import { parsePackageSize } from "../normalization";
import type { PriceObservationRecord } from "../types";
import { isCurrentlyValid, promotionText, type FlyerDeal, type OnlinePrice } from "./flipp";
import { buildMerchantIndex, resolveMerchant, storeRetailers, type KnownRetailer } from "./merchants";

/**
 * Turning raw search results into observations the app can trust.
 *
 * Results are grouped by the product they were searched for, and matched
 * against THAT product alone rather than against the whole catalogue. This
 * matters more than it sounds: a search for "Bananas" comes back full of
 * banana-flavoured everything, and matching each result against 1,479
 * candidates independently mapped banana gummies to chewing gum, banana
 * crisps to potato chips, and banana flour to all-purpose flour. The search
 * term is evidence, and throwing it away manufactured nonsense.
 *
 * Scoring and thresholds are unchanged, so a result that does not resemble
 * what was searched for is rejected rather than forced onto it.
 *
 * Everything rejected is counted and reported. A scan that found 200 deals
 * and could place 6 of them must not look like a scan that found 6 deals.
 */

/** Results, kept with the catalogue product whose name produced them. */
export type ResultGroup<T> = { catalogProductId: string; items: T[] };

/**
 * Catalogue categories whose website listings can be trusted to be the
 * product rather than a flavour of something else.
 *
 * Fresh-food words are the vocabulary packaged goods use for flavours and
 * scents. Searching an online marketplace for "Grapefruit" returns beard oil,
 * body butter and sparkling water; "Bacon" returns dog treats; "Honeycrisp
 * Apples" returns dish spray. Each of those genuinely contains the catalogue
 * concept in its name, so name matching cannot separate them — the ambiguity
 * is in the language, not in the scoring.
 *
 * Packaged categories don't have this problem: a listing named "Laundry
 * Detergent" is laundry detergent. So website prices are ingested for those
 * and left alone for fresh ones, where the flyer feed — curated ads from real
 * grocery stores — is the reliable source instead.
 *
 * This is a real limitation, recorded rather than papered over.
 */
export const ONLINE_ELIGIBLE_CATEGORIES = new Set([
  "Pantry",
  "Household",
  "Health & Beauty",
  "Drinks",
  "Snacks",
  "Confectionery",
  "Baby & Kids",
  "Pet",
  "Frozen",
]);

export type FlyerIngestSummary = {
  observations: PriceObservationRecord[];
  /** Deals seen in total, before any filtering. */
  seen: number;
  /** Dropped because the merchant isn't one of the household's retailers. */
  skippedUnknownMerchant: number;
  /** Dropped because the flyer window has passed or hasn't opened. */
  skippedExpired: number;
  /** Dropped because no catalogue product matched confidently enough. */
  skippedUnmatched: number;
};

export function buildFlyerObservations(input: {
  groups: ResultGroup<FlyerDeal>[];
  retailers: KnownRetailer[];
  catalogById: Map<string, MatchableCatalogProduct>;
  today: string;
  observedAt: string;
}): FlyerIngestSummary {
  const { groups, retailers, catalogById, today, observedAt } = input;
  const deals = groups.flatMap((g) => g.items.map((item) => ({ item, target: g.catalogProductId })));
  // Flyer deals are only worth keeping from stores the household actually
  // goes to. Online sellers are excluded here and handled separately, where
  // location doesn't apply.
  const index = buildMerchantIndex(storeRetailers(retailers));

  const summary: FlyerIngestSummary = {
    observations: [],
    seen: deals.length,
    skippedUnknownMerchant: 0,
    skippedExpired: 0,
    skippedUnmatched: 0,
  };

  for (const { item: deal, target } of deals) {
    const candidate = catalogById.get(target);
    if (!candidate) {
      summary.skippedUnmatched++;
      continue;
    }
    const retailer = resolveMerchant(index, deal.merchantName);
    if (!retailer) {
      summary.skippedUnknownMerchant++;
      continue;
    }
    if (!isCurrentlyValid(deal, today)) {
      summary.skippedExpired++;
      continue;
    }

    const match = matchToCatalog(
      {
        retailerId: retailer.id,
        retailerLocationId: null,
        externalProductId: deal.flyerItemId ?? "",
        url: deal.sourceUrl,
        name: deal.name,
        brand: null,
        observedAt,
      },
      [candidate],
    );

    // REVIEW_REQUIRED and UNMATCHED are not stored: an uncertain mapping
    // corrupts price comparison for that product from then on, and a deal
    // nobody can name isn't actionable anyway.
    if (match.status !== "MATCHED" && match.status !== "LIKELY_MATCH") {
      summary.skippedUnmatched++;
      continue;
    }

    const size = parsePackageSize(deal.name);

    summary.observations.push({
      catalogProductId: match.catalogProductId,
      retailerId: retailer.id,
      retailerLocationId: null,
      externalProductId: deal.flyerItemId,
      observedPriceCents: deal.priceCents,
      regularPriceCents: deal.originalPriceCents,
      unitPriceText: null,
      packageSize: size?.raw ?? null,
      unit: size?.unit ?? null,
      promotionText: promotionText(deal),
      validFrom: deal.validFrom,
      validUntil: deal.validTo,
      availability: null,
      sourceUrl: deal.sourceUrl,
      sourceType: "FLYER" satisfies PriceSourceType,
      matchConfidence: match.confidence,
      matchMethod: match.matchMethod,
      matchStatus: match.status,
      rawName: deal.name,
      rawBrand: null,
      imageUrl: deal.imageUrl,
      observedAt,
    });
  }

  return summary;
}

/**
 * Flyer deals for the product at stores that are not set up as retailers.
 *
 * `buildFlyerObservations` drops these on purpose: an observation has to name
 * a real retailer row, and price history must not fill up with stores the
 * household has never mentioned.
 *
 * But dropping them silently is what makes "where is this on sale" feel
 * broken. Measured on the real feed, a search for boneless skinless chicken
 * breast returned eight advertised prices and six were at stores not in the
 * table — Longo's, Sobeys, M&M, Real Canadian Superstore. Those are real ads
 * in real Burlington flyers and they are the answer to the question.
 *
 * So they are reported and not stored. Same expiry rule and same matching bar
 * as a stored observation — a deal that isn't this product is not shown just
 * because it can't be saved.
 */
export type UnstoredDeal = {
  merchantName: string;
  name: string;
  priceCents: number;
  validUntil: string | null;
};

export function findDealsAtOtherStores(input: {
  groups: ResultGroup<FlyerDeal>[];
  retailers: KnownRetailer[];
  catalogById: Map<string, MatchableCatalogProduct>;
  today: string;
}): UnstoredDeal[] {
  const { groups, retailers, catalogById, today } = input;
  // Every retailer, not just the stores: a deal at a known online retailer is
  // already handled elsewhere and must not be repeated here.
  const index = buildMerchantIndex(retailers);
  const out: UnstoredDeal[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    const candidate = catalogById.get(group.catalogProductId);
    if (!candidate) continue;
    for (const deal of group.items) {
      if (resolveMerchant(index, deal.merchantName)) continue;
      if (!isCurrentlyValid(deal, today)) continue;

      const match = matchToCatalog(
        {
          retailerId: "",
          retailerLocationId: null,
          externalProductId: deal.flyerItemId ?? "",
          url: deal.sourceUrl,
          name: deal.name,
          brand: null,
          observedAt: today,
        },
        [candidate],
      );
      if (match.status !== "MATCHED" && match.status !== "LIKELY_MATCH") continue;

      const key = `${deal.merchantName}|${deal.priceCents}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        merchantName: deal.merchantName,
        name: deal.name,
        priceCents: deal.priceCents,
        validUntil: deal.validTo,
      });
    }
  }

  return out.sort((a, b) => a.priceCents - b.priceCents);
}

/**
 * Deals whose flyer hasn't started yet.
 *
 * `isCurrentlyValid` rejects these, correctly: a stored observation must be a
 * price you can go and pay today. But "boneless skinless chicken breast is on
 * at Food Basics from Friday" is exactly what someone planning a shop wants,
 * and dropping it is why an on-demand check could look at a live feed carrying
 * three advertised prices for a product and report nothing.
 *
 * Reported, never stored, and always carrying the date it starts.
 */
export type UpcomingDeal = {
  merchantName: string;
  name: string;
  priceCents: number;
  /** YYYY-MM-DD, the first day the price applies. */
  startsOn: string;
};

/** Beyond this the flyer is too far off to plan around. */
const UPCOMING_HORIZON_DAYS = 10;

export function findUpcomingDeals(input: {
  groups: ResultGroup<FlyerDeal>[];
  catalogById: Map<string, MatchableCatalogProduct>;
  today: string;
}): UpcomingDeal[] {
  const { groups, catalogById, today } = input;
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + UPCOMING_HORIZON_DAYS);
  const horizonISO = horizon.toISOString().slice(0, 10);

  const out: UpcomingDeal[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    const candidate = catalogById.get(group.catalogProductId);
    if (!candidate) continue;
    for (const deal of group.items) {
      if (!deal.validFrom || deal.validFrom <= today || deal.validFrom > horizonISO) continue;

      const match = matchToCatalog(
        {
          retailerId: "",
          retailerLocationId: null,
          externalProductId: deal.flyerItemId ?? "",
          url: deal.sourceUrl,
          name: deal.name,
          brand: null,
          observedAt: today,
        },
        [candidate],
      );
      if (match.status !== "MATCHED" && match.status !== "LIKELY_MATCH") continue;

      const key = `${deal.merchantName}|${deal.priceCents}|${deal.validFrom}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        merchantName: deal.merchantName,
        name: deal.name,
        priceCents: deal.priceCents,
        startsOn: deal.validFrom,
      });
    }
  }

  return out.sort((a, b) => a.priceCents - b.priceCents);
}

/**
 * The listing that best represents what a product costs at one retailer.
 *
 * A website search for "Bacon" returns dozens of real listings at one shop —
 * packs, crumbles, chicken-bacon, value sizes. Storing all of them buries the
 * answer, and storing the cheapest is worse than useless: the cheapest "bacon"
 * at Walmart is a 75g tub of bacon crumble, which is not what anyone means.
 *
 * The middle listing by price is a real, observed listing (never an average of
 * several) and is far closer to what the product actually costs there. The
 * listing's own name is carried through, so the reader can see exactly which
 * one it was.
 */
export function pickRepresentative<T extends { priceCents: number; name: string }>(items: T[]): T | null {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => a.priceCents - b.priceCents || a.name.localeCompare(b.name));
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

export type OnlineIngestSummary = {
  observations: PriceObservationRecord[];
  seen: number;
  skippedUnknownMerchant: number;
  skippedUnmatched: number;
  /** Fresh-category products, where website listings are unreliable by nature
   *  (see ONLINE_ELIGIBLE_CATEGORIES) and flyers are used instead. */
  skippedFreshCategory: number;
};

/**
 * Turns website prices into observations.
 *
 * The merchant filter is deliberately looser than the flyer one: an online
 * price can be ordered from anywhere, so "do they shop there" is the wrong
 * question. It still has to be a retailer we know, because an observation
 * must name a real source.
 *
 * The catalogue match is held to the same bar as everywhere else — an
 * uncertain mapping corrupts price comparison for that product from then on.
 */
export function buildOnlineObservations(input: {
  groups: ResultGroup<OnlinePrice>[];
  retailers: KnownRetailer[];
  catalogById: Map<string, MatchableCatalogProduct>;
  observedAt: string;
}): OnlineIngestSummary {
  const { groups, retailers, catalogById, observedAt } = input;
  const index = buildMerchantIndex(retailers);

  const summary: OnlineIngestSummary = {
    observations: [],
    seen: groups.reduce((n, g) => n + g.items.length, 0),
    skippedUnknownMerchant: 0,
    skippedUnmatched: 0,
    skippedFreshCategory: 0,
  };

  // Match everything first, then reduce each (product, retailer) pair to the
  // one listing that represents it.
  type Matched = { price: OnlinePrice; retailer: KnownRetailer; match: ReturnType<typeof matchToCatalog>; target: string };
  const matched: Matched[] = [];

  for (const group of groups) {
    const candidate = catalogById.get(group.catalogProductId);
    if (!candidate) {
      summary.skippedUnmatched += group.items.length;
      continue;
    }
    if (!ONLINE_ELIGIBLE_CATEGORIES.has(candidate.category)) {
      summary.skippedFreshCategory += group.items.length;
      continue;
    }

    for (const price of group.items) {
      const retailer = resolveMerchant(index, price.merchantName);
      if (!retailer) {
        summary.skippedUnknownMerchant++;
        continue;
      }

      const match = matchToCatalog(
      {
        retailerId: retailer.id,
        retailerLocationId: null,
        externalProductId: price.sku ?? "",
        url: null,
          name: price.name,
          brand: null,
          observedAt,
        },
        [candidate],
      );

      if (match.status !== "MATCHED" && match.status !== "LIKELY_MATCH") {
        summary.skippedUnmatched++;
        continue;
      }
      matched.push({ price, retailer, match, target: group.catalogProductId });
    }
  }

  const byPair = new Map<string, Matched[]>();
  for (const row of matched) {
    const key = `${row.target}|${row.retailer.id}`;
    const bucket = byPair.get(key);
    if (bucket) bucket.push(row);
    else byPair.set(key, [row]);
  }

  for (const bucket of byPair.values()) {
    const chosen = pickRepresentative(bucket.map((b) => ({ ...b, priceCents: b.price.priceCents, name: b.price.name })));
    if (!chosen) continue;
    const { price, retailer, match } = chosen;
    const size = parsePackageSize(price.name);

    summary.observations.push({
      catalogProductId: match.catalogProductId,
      retailerId: retailer.id,
      retailerLocationId: null,
      externalProductId: price.sku,
      observedPriceCents: price.priceCents,
      regularPriceCents: price.originalPriceCents,
      unitPriceText: null,
      packageSize: size.raw,
      unit: size.unit,
      promotionText: null,
      // No window: this is today's price, not a dated promotion. Inventing an
      // expiry would make a stale price look current later on.
      validFrom: null,
      validUntil: null,
      availability: null,
      sourceUrl: null,
      sourceType: "ONLINE" satisfies PriceSourceType,
      matchConfidence: match.confidence,
      matchMethod: match.matchMethod,
      matchStatus: match.status,
      rawName: price.name,
      rawBrand: null,
      imageUrl: price.imageUrl,
      observedAt,
    });
  }

  return summary;
}
