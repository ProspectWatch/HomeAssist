import { createLoblawBannerAdapter } from "./loblaw-banner";
import type { RetailerAdapter } from "../types";

/**
 * Fortinos — a Loblaw banner. Transport and payload normalization are shared
 * (see loblaw-banner.ts); this file exists to keep Fortinos a distinct
 * retailer identity with its own id resolution, banner and site origin.
 */
export function createFortinosAdapter(resolveRetailerId: () => string): RetailerAdapter {
  return createLoblawBannerAdapter(
    {
      key: "fortinos",
      retailerName: "Fortinos",
      bannerId: "fortinos",
      siteOrigin: "https://www.fortinos.ca",
    },
    resolveRetailerId,
  );
}
