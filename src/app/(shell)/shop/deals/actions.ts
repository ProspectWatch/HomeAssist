"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { runHouseholdScan } from "@/lib/data/retailer-scan";
import { runFlyerScan } from "@/lib/data/flyer-scan";
import { runInstacartScan } from "@/lib/data/instacart-scan";
import { syncPriceNotifications } from "@/lib/data/notify";
import { addHouseholdNeed } from "@/app/(shell)/shop/pantry/actions";
import { formatCents } from "@/lib/money";

export type ScanActionResult = ActionResult & {
  summary?: string;
  perRetailer?: { retailerName: string; ok: boolean; note: string }[];
};

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

    // New prices are the only moment anything can newly be true, so this is
    // where notifications get derived. It never fails the scan: the prices are
    // already stored and are the valuable part.
    await syncPriceNotifications(householdId);

    revalidatePath("/shop/deals");
    revalidatePath("/home");
    revalidatePath("/notifications");

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

/**
 * Puts a deal on the shopping list.
 *
 * The list stores the household's own generic name for the thing, not the
 * flyer's wording — "Bacon", never "SCHNEIDERS® BACON, 375G" — because that
 * is what duplicate matching and every later comparison work on. What the
 * flyer actually said goes in the note, so the reason it was added is still
 * legible at the shelf: the price, the store, and when the offer ends.
 *
 * Routed through addHouseholdNeed so duplicate protection cannot be bypassed:
 * adding a deal for something already on the list updates that row instead of
 * creating a second one.
 */
export async function addDealToList(input: {
  catalogProductId: string;
  name: string;
  retailerName: string | null;
  priceCents: number;
  validUntil: string | null;
}): Promise<ActionResult & { alreadyOnList?: boolean }> {
  if (!input.catalogProductId || !input.name) {
    return { ok: false, message: "That deal has nothing to add." };
  }

  const parts = [formatCents(input.priceCents)];
  if (input.retailerName) parts.push(`at ${input.retailerName}`);
  if (input.validUntil) {
    parts.push(
      `until ${new Date(`${input.validUntil}T12:00:00Z`).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
      })}`,
    );
  }

  const result = await addHouseholdNeed({
    catalogProductId: input.catalogProductId,
    name: input.name,
    note: parts.join(" "),
    // A person tapped this, so it is a manual add — not something the app
    // decided on their behalf.
    source: "MANUAL",
  });

  if (result.ok) revalidatePath("/shop/deals");
  return result;
}

export type InstacartScanActionResult = ActionResult & { summary?: string; detail?: string };

/**
 * Checks Marilu's Market prices from its Instacart listing.
 *
 * Kept separate from the flyer scan because it is a different kind of source
 * and should be readable as one: Marilu's publishes no flyer, so nothing else
 * in the app can see its prices, and what comes back is what Instacart lists
 * for the store rather than what is on the shelf. The summary says so, and the
 * observations are stored under their own source type so no comparison can
 * confuse the two.
 */
export async function scanMarilusPrices(): Promise<InstacartScanActionResult> {
  return runHouseholdAction<InstacartScanActionResult>(async (_supabase, householdId) => {
    const result = await runInstacartScan(householdId);
    if (result.status === "FAILED") return { ok: false, message: result.message };

    await syncPriceNotifications(householdId);

    revalidatePath("/shop/deals");
    revalidatePath("/price-history");
    revalidatePath("/home");
    revalidatePath("/notifications");

    const parts = [
      `${result.storefrontSeen} featured products read`,
      `${result.targetsRequested} of your products looked up`,
      `${result.stored} prices stored`,
    ];
    const notes = [
      result.notStocked > 0 ? `${result.notStocked} aren't carried at Marilu's` : null,
      result.weightPriced > 0
        ? `${result.weightPriced} are priced by weight, so they're recorded with their unit rather than as a pack price`
        : null,
      result.skippedAmbiguous > 0
        ? `${result.skippedAmbiguous} couldn't be matched to a product with confidence and were skipped`
        : null,
      result.totalTargets > result.targetsRequested
        ? "Run again to work through the rest — each run picks up where the last left off."
        : null,
    ].filter((n): n is string => !!n);

    return {
      ok: true,
      summary: parts.join(" · "),
      detail: [
        "These are the prices Instacart lists for Marilu's, which may differ from the shelf.",
        ...notes,
      ].join(" "),
    };
  });
}
