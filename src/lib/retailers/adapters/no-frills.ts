import { createLoblawBannerAdapter } from "./loblaw-banner";
import type { RetailerAdapter } from "../types";

/**
 * No Frills — also a Loblaw banner, so it reuses the shared transport and
 * normalization rather than duplicating it (§10), while remaining a separate
 * retailer with its own identity in the registry and in price history.
 */
export function createNoFrillsAdapter(resolveRetailerId: () => string): RetailerAdapter {
  return createLoblawBannerAdapter(
    {
      key: "no-frills",
      retailerName: "No Frills",
      bannerId: "nofrills",
      siteOrigin: "https://www.nofrills.ca",
    },
    resolveRetailerId,
  );
}
