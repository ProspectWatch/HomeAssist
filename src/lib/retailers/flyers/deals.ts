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
      observedAt,
    });
  }

  return summary;
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
      observedAt,
    });
  }

  return summary;
}
