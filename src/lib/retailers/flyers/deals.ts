import { matchToCatalog, type MatchableCatalogProduct } from "../matching";
import { parsePackageSize } from "../normalization";
import type { PriceObservationRecord } from "../types";
import { isCurrentlyValid, promotionText, type FlyerDeal } from "./flipp";
import { buildMerchantIndex, resolveMerchant, type KnownRetailer } from "./merchants";

/**
 * Turning raw flyer deals into observations the app can trust.
 *
 * Two gates, both deliberate:
 *   - the merchant must be one the household shops at, and
 *   - the flyer item must match a catalogue product confidently enough.
 *
 * Everything rejected is counted and reported. A scan that found 200 deals
 * and could place 6 of them must not look like a scan that found 6 deals.
 */

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
  deals: FlyerDeal[];
  retailers: KnownRetailer[];
  catalog: MatchableCatalogProduct[];
  today: string;
  observedAt: string;
}): FlyerIngestSummary {
  const { deals, retailers, catalog, today, observedAt } = input;
  const index = buildMerchantIndex(retailers);

  const summary: FlyerIngestSummary = {
    observations: [],
    seen: deals.length,
    skippedUnknownMerchant: 0,
    skippedExpired: 0,
    skippedUnmatched: 0,
  };

  for (const deal of deals) {
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
      catalog,
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
      sourceType: "FLYER",
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
