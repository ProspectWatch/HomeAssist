/**
 * Resolving a flyer's merchant to one of the household's retailers.
 *
 * Flipp returns deals from every merchant that files a flyer for the postal
 * code — forty-odd stores in a typical Ontario city. Only the ones the
 * household actually shops at are kept. That isn't a technical limit: a
 * bargain at a store nobody drives to is noise, and the `retailers` table is
 * the household's own statement of where it shops.
 *
 * Nothing here invents a retailer. An unrecognised merchant is reported as
 * skipped, never quietly attached to the nearest-sounding store.
 */

export type RetailerKind = "STORE" | "ONLINE";

export type KnownRetailer = { id: string; name: string; kind: RetailerKind };

/** Case, punctuation and possessives removed; spacing collapsed. Enough to
 *  match "Farm Boy" to "Farm Boy" and "Marilu's Market" to "Marilus Market"
 *  without pretending "Fortinos" and "Food Basics" are the same shop. */
export function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]s\b/g, "s")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildMerchantIndex(retailers: KnownRetailer[]): Map<string, KnownRetailer> {
  const index = new Map<string, KnownRetailer>();
  for (const retailer of retailers) {
    const key = normalizeMerchant(retailer.name);
    if (key) index.set(key, retailer);
  }
  return index;
}

export function resolveMerchant(
  index: Map<string, KnownRetailer>,
  merchantName: string,
): KnownRetailer | null {
  return index.get(normalizeMerchant(merchantName)) ?? null;
}

/** Physical stores the household shops at — the only ones a flyer deal is
 *  useful from. */
export function storeRetailers(retailers: KnownRetailer[]): KnownRetailer[] {
  return retailers.filter((r) => r.kind === "STORE");
}
