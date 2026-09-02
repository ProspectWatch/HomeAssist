"use server";

import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { checkProductPrice } from "@/lib/data/product-price-check";

export type PriceCheckActionResult = {
  offers: { label: string; priceCents: number }[];
  elsewhere: { label: string; priceCents: number }[];
  upcoming: { label: string; priceCents: number }[];
  message: string;
  failed: boolean;
};

/**
 * "Check prices now" from a search result.
 *
 * The scheduled sweeps only ever reach a fraction of the catalogue, so most
 * products a person searches for have no price on record. Rather than leaving
 * search to report that gap, this goes and looks — same sources, same
 * matching, same storage as the sweeps, so what it finds is kept.
 */
export async function checkPriceNow(catalogProductId: string): Promise<PriceCheckActionResult> {
  if (!catalogProductId) {
    return { offers: [], elsewhere: [], upcoming: [], message: "No product to check.", failed: true };
  }
  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return {
      offers: [],
      elsewhere: [],
      upcoming: [],
      message: "Sign in to your household first.",
      failed: true,
    };
  }
  try {
    return await checkProductPrice(householdId, catalogProductId);
  } catch {
    return {
      offers: [],
      elsewhere: [],
      upcoming: [],
      message: "Couldn't reach the price sources just now.",
      failed: true,
    };
  }
}
