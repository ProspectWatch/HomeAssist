import { createFortinosAdapter } from "./adapters/fortinos";
import { createNoFrillsAdapter } from "./adapters/no-frills";
import type { RetailerAdapter } from "./types";

/**
 * Retailers HomeAssist can currently ingest from.
 *
 * Phase 3A scope is deliberately Fortinos + No Frills only. Food Basics,
 * Costco and Marilu's Market are real household retailers but have no adapter
 * yet, and are absent here rather than stubbed — an unimplemented retailer must
 * never look like one that returned no deals.
 */
export const SUPPORTED_RETAILER_KEYS = ["fortinos", "no-frills"] as const;
export type SupportedRetailerKey = (typeof SUPPORTED_RETAILER_KEYS)[number];

/** Adapter key -> the retailers.name it corresponds to. */
export const RETAILER_NAME_BY_KEY: Record<SupportedRetailerKey, string> = {
  fortinos: "Fortinos",
  "no-frills": "No Frills",
};

/**
 * Builds the adapters, binding each to its real retailers.id.
 * A retailer missing from the database is skipped rather than invented.
 */
export function buildAdapters(retailerIdsByName: Map<string, string>): RetailerAdapter[] {
  const adapters: RetailerAdapter[] = [];

  const fortinosId = retailerIdsByName.get("Fortinos");
  if (fortinosId) adapters.push(createFortinosAdapter(() => fortinosId));

  const noFrillsId = retailerIdsByName.get("No Frills");
  if (noFrillsId) adapters.push(createNoFrillsAdapter(() => noFrillsId));

  return adapters;
}
