import type { DealAssessment } from "./types";

/**
 * Discount-off-regular-price thresholds. Placeholder values pending real
 * historical pricing depth — tune once live retailer data exists. All are
 * fractions of `regularPriceCents` (e.g. 0.10 = 10% off).
 */
export const DEAL_THRESHOLDS = {
  decent: 0.05,
  good: 0.1,
  great: 0.2,
  stockUp: 0.3,
};

export interface ClassifyDealInput {
  currentPriceCents: number;
  /** The retailer's own non-promo price, when known. */
  regularPriceCents: number | null;
  /** Past observed prices for this product (any retailer), most recent last. */
  historicalPriceCents: number[];
  /** watch_items.target_price_cents, if the household set one. */
  targetPriceCents: number | null;
}

/**
 * Classifies how good `currentPriceCents` is, using only real inputs the
 * caller actually has. Returns `quality: null` (never a guessed category)
 * whenever there isn't at least one real reference point — a regular
 * price, price history, or a target price — to judge it against.
 */
export function classifyDeal(input: ClassifyDealInput): DealAssessment {
  const { currentPriceCents, regularPriceCents, historicalPriceCents, targetPriceCents } = input;

  const hasSufficientData =
    regularPriceCents !== null || historicalPriceCents.length > 0 || targetPriceCents !== null;

  if (!hasSufficientData) {
    return {
      quality: null,
      hasSufficientData: false,
      reason: "Not enough price history for this product yet to judge whether this is a deal.",
      targetPriceHit: false,
      isAllTimeLow: false,
    };
  }

  const targetPriceHit = targetPriceCents !== null && currentPriceCents <= targetPriceCents;

  const lowestKnown =
    historicalPriceCents.length > 0 ? Math.min(...historicalPriceCents) : null;
  const isAllTimeLow =
    lowestKnown !== null &&
    currentPriceCents <= lowestKnown &&
    (regularPriceCents === null || currentPriceCents < regularPriceCents);

  const percentOffRegular =
    regularPriceCents !== null && regularPriceCents > 0
      ? (regularPriceCents - currentPriceCents) / regularPriceCents
      : null;

  if (isAllTimeLow) {
    return {
      quality: "ALL_TIME_LOW",
      hasSufficientData: true,
      reason: `The lowest price we've seen for this product — previous low was ${formatCents(lowestKnown)}.`,
      targetPriceHit,
      isAllTimeLow: true,
    };
  }

  if (targetPriceHit) {
    return {
      quality: "TARGET_HIT",
      hasSufficientData: true,
      reason: `At or below your target price of ${formatCents(targetPriceCents)}.`,
      targetPriceHit: true,
      isAllTimeLow: false,
    };
  }

  if (percentOffRegular !== null) {
    if (percentOffRegular >= DEAL_THRESHOLDS.stockUp) {
      return {
        quality: "STOCK_UP",
        hasSufficientData: true,
        reason: `${Math.round(percentOffRegular * 100)}% off regular price — worth stocking up if it doesn't spoil.`,
        targetPriceHit,
        isAllTimeLow: false,
      };
    }
    if (percentOffRegular >= DEAL_THRESHOLDS.great) {
      return {
        quality: "GREAT_BUY",
        hasSufficientData: true,
        reason: `${Math.round(percentOffRegular * 100)}% off regular price.`,
        targetPriceHit,
        isAllTimeLow: false,
      };
    }
    if (percentOffRegular >= DEAL_THRESHOLDS.good) {
      return {
        quality: "GOOD_BUY",
        hasSufficientData: true,
        reason: `${Math.round(percentOffRegular * 100)}% off regular price.`,
        targetPriceHit,
        isAllTimeLow: false,
      };
    }
    if (percentOffRegular >= DEAL_THRESHOLDS.decent) {
      return {
        quality: "DECENT_DEAL",
        hasSufficientData: true,
        reason: `A little below regular price (${Math.round(percentOffRegular * 100)}% off).`,
        targetPriceHit,
        isAllTimeLow: false,
      };
    }
  }

  return {
    quality: "NORMAL",
    hasSufficientData: true,
    reason: "Around the usual price for this product.",
    targetPriceHit,
    isAllTimeLow: false,
  };
}

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}
