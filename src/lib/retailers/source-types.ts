/**
 * Where a price observation came from.
 *
 * This list is mirrored by a CHECK constraint on
 * retailer_price_observations.source_type (migration 0025). The two must
 * agree, and they did not once: website-price ingestion shipped emitting
 * "ONLINE" while the constraint still listed only the older sources, so every
 * scan failed at the insert. Nothing in the unit tests could catch it —
 * they exercise pure functions and never touch a database.
 *
 * So: adding a source type means adding it in BOTH places. The test beside
 * this file asserts that everything the ingestion builders actually emit
 * appears here, which turns the next mismatch into a failing test rather than
 * an empty Deals page.
 */
export const PRICE_SOURCE_TYPES = [
  /** A price this household actually paid, off a receipt. */
  "RECEIPT",
  /** A shelf price someone typed in without buying. */
  "MANUAL",
  /** An advertised price from a weekly flyer. */
  "FLYER",
  /** A retailer's current website price. */
  "ONLINE",
  /** A live shelf price, if a retailer ever permits reading one. */
  "RETAILER_LIVE",
  "OTHER_VERIFIED",
  "adapter",
] as const;

export type PriceSourceType = (typeof PRICE_SOURCE_TYPES)[number];

/** Mirrors the database constraint, including its `adapter:<key>` prefix form. */
export function isAllowedSourceType(value: string): boolean {
  return (PRICE_SOURCE_TYPES as readonly string[]).includes(value) || value.startsWith("adapter:");
}
