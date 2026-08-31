"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { runHouseholdScan } from "@/lib/data/retailer-scan";
import { runFlyerScan } from "@/lib/data/flyer-scan";

export type ScanActionResult = ActionResult & {
  summary?: string;
  perRetailer?: { retailerName: string; ok: boolean; note: string }[];
};

/**
 * Manual "check prices now" (§13). Reports honestly per retailer: a blocked or
 * failing retailer is surfaced as unavailable, never as a store that was
 * successfully checked and simply had no deals.
 */
export async function runManualScan(): Promise<ScanActionResult> {
  return runHouseholdAction<ScanActionResult>(async (_supabase, householdId) => {
    const result = await runHouseholdScan(householdId);

    const perRetailer = result.outcomes.map((o) =>
      o.status === "COMPLETE"
        ? {
            retailerName: o.retailerName,
            ok: true,
            note: `${o.observations.length} price${o.observations.length === 1 ? "" : "s"} found`,
          }
        : { retailerName: o.retailerName, ok: false, note: `Scan unavailable — ${o.reason}` },
    );

    const okCount = perRetailer.filter((r) => r.ok).length;
    revalidatePath("/shop/deals");
    revalidatePath("/shop/list");
    revalidatePath("/home");

    return {
      ok: true,
      summary: `${okCount} / ${result.outcomes.length} retailers checked · ${result.observationsStored} price observations stored`,
      perRetailer,
    };
  });
}

/**
 * Records a price seen on a shelf or in a flyer without buying it.
 *
 * This is the one way the price book grows between receipts, and it is how a
 * flyer price gets into the comparison at all while live retailer pricing is
 * unavailable. It writes a real observation with its real source — a
 * hand-entered price is marked MANUAL and never dressed up as a scan.
 */
export async function logSeenPrice(input: {
  catalogProductId: string;
  retailerId: string;
  priceCents: number;
  note?: string | null;
}): Promise<ActionResult> {
  if (!input.catalogProductId) return { ok: false, message: "Pick a product first." };
  if (!input.retailerId) return { ok: false, message: "Pick which store you saw it at." };
  if (!Number.isFinite(input.priceCents) || input.priceCents <= 0) {
    return { ok: false, message: "Enter a price." };
  }

  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase.from("retailer_price_observations").upsert(
      {
        household_id: householdId,
        catalog_product_id: input.catalogProductId,
        retailer_id: input.retailerId,
        observed_price_cents: input.priceCents,
        promotion_text: input.note?.trim() || null,
        source_type: "MANUAL",
        match_status: "MATCHED",
        match_confidence: 1,
        match_method: "manual_entry",
        observed_at: new Date().toISOString(),
      },
      { ignoreDuplicates: true },
    );
    if (error) return { ok: false, message: error.message };

    revalidatePath("/shop/deals");
    revalidatePath("/price-history");
    revalidatePath("/home");
    return { ok: true };
  });
}

export type FlyerScanActionResult = ActionResult & {
  summary?: string;
  /** What the scan looked at and what it could not place, so a thin result is
   *  explicable rather than mysterious. */
  detail?: string;
};

/**
 * Checks this week's flyers and the retailers' website prices for the
 * household's own products.
 *
 * Reports what actually happened, including the parts that didn't work: a
 * scan that saw 300 deals and could place 4 says so, because "4 deals found"
 * on its own reads as "there are only 4 deals" and sends someone shopping on
 * a false picture.
 */
export async function scanFlyerDeals(): Promise<FlyerScanActionResult> {
  return runHouseholdAction<FlyerScanActionResult>(async (_supabase, householdId) => {
    const result = await runFlyerScan(householdId);

    if (result.status === "FAILED") {
      return { ok: false, message: result.message };
    }

    revalidatePath("/shop/deals");
    revalidatePath("/home");

    const placed = result.observations.length;
    const coverage =
      result.totalTargets > result.targetsRequested
        ? `${result.targetsRequested} of ${result.totalTargets} products searched`
        : `${result.targetsRequested} product${result.targetsRequested === 1 ? "" : "s"} searched`;
    const parts = [
      coverage,
      `${result.seen} flyer deals · ${result.onlineSeen} website prices seen`,
      `${placed + result.onlineStored} matched to your list`,
    ];
    const skipped = [
      result.skippedUnknownMerchant > 0
        ? `${result.skippedUnknownMerchant} flyer deals at stores you don't shop`
        : null,
      result.skippedUnmatched > 0 ? `${result.skippedUnmatched} we couldn't identify` : null,
      result.skippedExpired > 0 ? `${result.skippedExpired} expired` : null,
      result.skippedFreshCategory > 0
        ? `${result.skippedFreshCategory} fresh-food website listings (flyers cover those)`
        : null,
    ].filter((p): p is string => !!p);

    return {
      ok: true,
      summary: parts.join(" · "),
      detail: [
        skipped.length > 0 ? `Skipped: ${skipped.join(", ")}.` : null,
        result.totalTargets > result.targetsRequested
          ? "Run again to work through the rest — each scan picks up where the last left off."
          : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    };
  });
}
