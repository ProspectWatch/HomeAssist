import { classifyDeal } from "./deal-quality";
import { rankCandidates } from "./product-matching";
import type {
  PriceObservation,
  ProductCandidate,
  ProductNeed,
  ShoppingPlanResult,
  ShoppingRecommendation,
  StoreVisit,
} from "./types";

/**
 * A store that's merely $0.50 cheaper on one item isn't worth a separate
 * trip. This is the aggregate bar a not-yet-visited retailer's total
 * savings (across every item it's cheaper on) must clear before the
 * engine adds it as a new stop. Placeholder value — a real household
 * could tune this, or it could scale with `travelCosts` once that's wired
 * to something real (see step 11: distance/drive-time stay optional).
 */
export const MIN_AGGREGATE_SAVINGS_FOR_NEW_STOP_CENTS = 500;

/**
 * A preferred retailer (household_product_preferences) is worth a small
 * price premium on its own, independent of the aggregate-stop math above
 * — "Marilu's is preferred for produce and the difference is only $0.30."
 */
export const PREFERRED_RETAILER_TOLERANCE_CENTS = 100;

export interface RetailerMeta {
  id: string;
  name: string;
}

export interface NeedWithCandidates {
  need: ProductNeed;
  candidates: ProductCandidate[];
}

export interface BuildShoppingPlanInput {
  items: NeedWithCandidates[];
  retailers: RetailerMeta[];
  /** Stores already on the household's map for this run — the "already
   *  going to Fortinos" case. */
  existingPlannedStops?: StoreVisit[];
  /** Real price history, for deal-quality classification and "all-time
   *  low" context. Keyed loosely by catalogueProductId — never fabricated. */
  priceObservations?: PriceObservation[];
  /** Optional per-retailer trip-cost context (step 11: optional inputs,
   *  no route optimization). When provided for a candidate new stop, its
   *  driveTimeMinutes nudges the required aggregate savings up slightly
   *  instead of being ignored. */
  travelCosts?: Record<string, { distanceKm: number | null; driveTimeMinutes: number | null }>;
  minAggregateSavingsForNewStopCents?: number;
}

function retailerName(retailers: RetailerMeta[], id: string | null): string {
  if (!id) return "an unknown store";
  return retailers.find((r) => r.id === id)?.name ?? "that store";
}

function historyFor(observations: PriceObservation[], catalogueProductId: string | null): number[] {
  if (!catalogueProductId) return [];
  return observations
    .filter((o) => o.catalogueProductId === catalogueProductId)
    .map((o) => o.observedPriceCents);
}

/**
 * Builds this week's shopping plan: for each need, which store to buy it
 * at and why, plus which stores (beyond ones already planned) are worth
 * adding as a new stop. Never invents a recommendation — a need with no
 * candidates gets an honest "no price data yet" result, and the whole
 * plan reports `status: "insufficient_data"` when that's true everywhere.
 *
 * Two passes, matching the brief's worked examples exactly:
 *  1. For every retailer not already planned, sum the savings it offers
 *     across all items (vs. the cheapest already-planned option) — only
 *     retailers clearing the aggregate threshold get added as a new stop.
 *  2. Resolve each need to a specific store: an already-planned store
 *     wins on price ties or small savings; a preferred retailer wins
 *     within its own small tolerance; otherwise the best-match cheapest
 *     candidate wins.
 */
export function buildShoppingPlan(input: BuildShoppingPlanInput): ShoppingPlanResult {
  const {
    items,
    retailers,
    existingPlannedStops = [],
    priceObservations = [],
    travelCosts = {},
    minAggregateSavingsForNewStopCents = MIN_AGGREGATE_SAVINGS_FOR_NEW_STOP_CENTS,
  } = input;

  if (items.length === 0) {
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

  const withCandidates = items.filter((i) => i.candidates.length > 0);
  if (withCandidates.length === 0) {
    return {
      status: "insufficient_data",
      summary: "Add current store prices to build this week's plan.",
      trips: [],
      recommendations: items.map((i) => noDataRecommendation(i.need)),
      estimatedSpendCents: null,
      estimatedSavingsCents: null,
      avoidedStops: [],
    };
  }

  // Best-match-tier candidates per need, cheapest first within that tier.
  const rankedByNeed = withCandidates.map((i) => {
    const ranked = rankCandidates(i.need, i.candidates);
    const topQuality = ranked[0].matchQuality;
    return { need: i.need, ranked: ranked.filter((m) => m.matchQuality === topQuality) };
  });

  const plannedStops = new Set(existingPlannedStops.map((v) => v.retailerId));
  const initiallyPlanned = new Set(plannedStops);

  // --- Pass 1: which not-yet-planned retailers earn a new stop? ---
  const candidateRetailers = new Set<string>();
  for (const { ranked } of rankedByNeed) {
    for (const m of ranked) candidateRetailers.add(m.candidate.retailerId);
  }

  const aggregateSavingsByRetailer = new Map<string, number>();
  for (const retailerId of candidateRetailers) {
    if (plannedStops.has(retailerId)) continue;
    let savings = 0;
    for (const { ranked } of rankedByNeed) {
      const atThisRetailer = ranked.find((m) => m.candidate.retailerId === retailerId);
      if (!atThisRetailer) continue;
      const cheapestAtPlanned = ranked
        .filter((m) => plannedStops.has(m.candidate.retailerId))
        .sort((a, b) => a.candidate.priceCents - b.candidate.priceCents)[0];
      const baseline = cheapestAtPlanned
        ? cheapestAtPlanned.candidate.priceCents
        : Math.min(...ranked.map((m) => m.candidate.priceCents));
      const diff = baseline - atThisRetailer.candidate.priceCents;
      if (diff > 0) savings += diff;
    }
    if (savings > 0) aggregateSavingsByRetailer.set(retailerId, savings);
  }

  const addedStops: { retailerId: string; savingsCents: number }[] = [];
  const avoidedStops: { retailerId: string; reason: string }[] = [];
  const sortedCandidates = [...aggregateSavingsByRetailer.entries()].sort((a, b) => b[1] - a[1]);
  for (const [retailerId, savings] of sortedCandidates) {
    const drive = travelCosts[retailerId]?.driveTimeMinutes ?? null;
    // A longer optional drive time raises the bar slightly rather than
    // being ignored — still no route optimization, just a nudge.
    const requiredSavings =
      minAggregateSavingsForNewStopCents + (drive && drive > 15 ? (drive - 15) * 20 : 0);
    if (savings >= requiredSavings) {
      plannedStops.add(retailerId);
      addedStops.push({ retailerId, savingsCents: savings });
    } else {
      avoidedStops.push({
        retailerId,
        reason: `Only ${formatCents(savings)} in savings — not enough to justify a separate trip to ${retailerName(retailers, retailerId)}.`,
      });
    }
  }

  // --- Pass 2: resolve each need to a specific store. ---
  const recommendations: ShoppingRecommendation[] = [];
  let estimatedSpendCents = 0;
  let estimatedSavingsCents = 0;

  for (const { need, ranked } of rankedByNeed) {
    const preferredStoreId = need.preference?.preferredStoreId ?? null;
    const cheapest = ranked.reduce((a, b) => (a.candidate.priceCents <= b.candidate.priceCents ? a : b));

    const atPlanned = ranked
      .filter((m) => plannedStops.has(m.candidate.retailerId))
      .sort((a, b) => a.candidate.priceCents - b.candidate.priceCents)[0];
    const atPreferred = preferredStoreId
      ? ranked.find((m) => m.candidate.retailerId === preferredStoreId)
      : undefined;

    let chosen = cheapest;
    let reason: string;
    let requiresNewStop = false;
    let addedRetailerId: string | null = null;
    let aggregateSavingsCentsIfAdded: number | null = null;

    if (atPreferred && atPreferred.candidate.priceCents - cheapest.candidate.priceCents <= PREFERRED_RETAILER_TOLERANCE_CENTS) {
      chosen = atPreferred;
      const diff = atPreferred.candidate.priceCents - cheapest.candidate.priceCents;
      reason =
        diff <= 0
          ? `${retailerName(retailers, atPreferred.candidate.retailerId)} is preferred for this item and has the best price.`
          : `${retailerName(retailers, atPreferred.candidate.retailerId)} is preferred for this item, and the price difference is only ${formatCents(diff)}.`;
      if (!initiallyPlanned.has(atPreferred.candidate.retailerId)) {
        requiresNewStop = true;
        addedRetailerId = atPreferred.candidate.retailerId;
      }
    } else if (atPlanned && !initiallyPlanned.has(atPlanned.candidate.retailerId)) {
      // The cheapest currently-planned option for this item is a stop that
      // pass 1 added for aggregate reasons — attribute the whole
      // recommendation to that, even if this specific item wasn't the
      // biggest contributor to the aggregate savings.
      chosen = atPlanned;
      requiresNewStop = true;
      addedRetailerId = atPlanned.candidate.retailerId;
      const addedStop = addedStops.find((s) => s.retailerId === atPlanned.candidate.retailerId);
      aggregateSavingsCentsIfAdded = addedStop?.savingsCents ?? null;
      reason = addedStop
        ? `${retailerName(retailers, atPlanned.candidate.retailerId)} saves ${formatCents(addedStop.savingsCents)} across everything on your list from there, so the extra stop is worthwhile.`
        : `Best available price for this item, at ${retailerName(retailers, atPlanned.candidate.retailerId)}.`;
    } else if (atPlanned) {
      chosen = atPlanned;
      const cheaperElsewhere = ranked.find(
        (m) => m.candidate.retailerId !== atPlanned.candidate.retailerId && m.candidate.priceCents <= atPlanned.candidate.priceCents,
      );
      if (!cheaperElsewhere) {
        reason = `Best price, at ${retailerName(retailers, atPlanned.candidate.retailerId)} — already on your list of stops.`;
      } else {
        const diff = atPlanned.candidate.priceCents - cheaperElsewhere.candidate.priceCents;
        reason =
          diff <= 0
            ? `Same price as ${retailerName(retailers, cheaperElsewhere.candidate.retailerId)} and you're already going to ${retailerName(retailers, atPlanned.candidate.retailerId)}.`
            : `${retailerName(retailers, cheaperElsewhere.candidate.retailerId)} is ${formatCents(diff)} cheaper, but not enough to justify a separate trip — buying at ${retailerName(retailers, atPlanned.candidate.retailerId)}, where you're already going.`;
      }
    } else {
      chosen = cheapest;
      reason = `Best available price for this item, at ${retailerName(retailers, cheapest.candidate.retailerId)}.`;
    }

    const history = historyFor(priceObservations, need.catalogueProductId);
    const observation = priceObservations.find(
      (o) => o.catalogueProductId === need.catalogueProductId && o.retailerId === chosen.candidate.retailerId,
    );
    const deal = classifyDeal({
      currentPriceCents: chosen.candidate.priceCents,
      regularPriceCents: observation?.regularPriceCents ?? null,
      historicalPriceCents: history,
      targetPriceCents: need.targetPriceCents,
    });

    estimatedSpendCents += chosen.candidate.priceCents;

    recommendations.push({
      need,
      recommendedCandidate: chosen.candidate,
      recommendedRetailerId: chosen.candidate.retailerId,
      recommendedPriceCents: chosen.candidate.priceCents,
      unitPriceCents: chosen.candidate.unitPriceCents,
      matchQuality: chosen.matchQuality,
      dealQuality: deal.quality,
      reason,
      otherOptions: ranked.filter((m) => m !== chosen).map((m) => m.candidate),
      tripImpact: { requiresNewStop, addedRetailerId, aggregateSavingsCentsIfAdded },
      historicalContext: {
        hasHistory: history.length > 0,
        lowestObservedPriceCents: history.length > 0 ? Math.min(...history) : null,
        isAllTimeLow: deal.isAllTimeLow,
      },
      confidence: chosen.matchQuality === "EXACT" || chosen.matchQuality === "VERY_CLOSE" ? 0.9 : 0.6,
    });
  }

  for (const { savingsCents } of addedStops) estimatedSavingsCents += savingsCents;

  const noDataNeeds = items.filter((i) => i.candidates.length === 0);
  for (const i of noDataNeeds) recommendations.push(noDataRecommendation(i.need));

  const stopCount = plannedStops.size;
  const summary =
    addedStops.length > 0
      ? `${stopCount} store stop${stopCount === 1 ? "" : "s"} this week — adding ${addedStops.map((s) => retailerName(retailers, s.retailerId)).join(", ")} saves ${formatCents(estimatedSavingsCents)}.`
      : `${stopCount} store stop${stopCount === 1 ? "" : "s"} this week, at your usual ${stopCount === 1 ? "store" : "stores"}.`;

  const trips = [...plannedStops].map((retailerId) => ({
    visits: [
      {
        retailerId,
        reason: (initiallyPlanned.has(retailerId) ? "planned" : "added_by_plan") as StoreVisit["reason"],
        distanceKm: travelCosts[retailerId]?.distanceKm ?? null,
        driveTimeMinutes: travelCosts[retailerId]?.driveTimeMinutes ?? null,
      },
    ],
    matches: recommendations
      .filter((r) => r.recommendedRetailerId === retailerId)
      .map((r) => ({
        need: r.need,
        candidate: r.recommendedCandidate!,
        matchQuality: r.matchQuality!,
        matchReason: r.reason,
      })),
    estimatedTotalCents: recommendations
      .filter((r) => r.recommendedRetailerId === retailerId)
      .reduce((sum, r) => sum + (r.recommendedPriceCents ?? 0), 0),
  }));

  return {
    status: noDataNeeds.length === items.length ? "insufficient_data" : "ready",
    summary,
    trips,
    recommendations,
    estimatedSpendCents,
    estimatedSavingsCents,
    avoidedStops,
  };
}

function noDataRecommendation(need: ProductNeed): ShoppingRecommendation {
  return {
    need,
    recommendedCandidate: null,
    recommendedRetailerId: null,
    recommendedPriceCents: null,
    unitPriceCents: null,
    matchQuality: null,
    dealQuality: null,
    reason: "No price data yet for this item.",
    otherOptions: [],
    tripImpact: { requiresNewStop: false, addedRetailerId: null, aggregateSavingsCentsIfAdded: null },
    historicalContext: { hasHistory: false, lowestObservedPriceCents: null, isAllTimeLow: false },
    confidence: 0,
  };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
