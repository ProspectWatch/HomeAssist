import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  isMultiItemOffer,
  parseFlippEcomItems,
  parseFlippItems,
  searchFlipp,
} from "@/lib/retailers/flyers/flipp";
import {
  buildFlyerObservations,
  buildOnlineObservations,
  findDealsAtOtherStores,
  findUpcomingDeals,
  type UnstoredDeal,
  type UpcomingDeal,
} from "@/lib/retailers/flyers/deals";
import { isWeightPriced } from "@/lib/retailers/instacart/parse";
import type { KnownRetailer } from "@/lib/retailers/flyers/merchants";
import type { MatchableCatalogProduct } from "@/lib/retailers/matching";
import { AdapterError, type PriceObservationRecord } from "@/lib/retailers/types";
import { storeObservations } from "@/lib/data/flyer-scan";
import { getLocationContext } from "@/lib/data/retailer-scan";
import { findAtMarilus } from "@/lib/data/instacart-scan";
import {
  bestOfferByProduct,
  classifySource,
  describeOffer,
  type ProductOffer,
} from "@/lib/pricing/best-offer";

/**
 * "Where is this on sale right now?" for one product, asked on demand.
 *
 * The scheduled sweeps are deliberately bounded — 60 products a run for
 * flyers, 12 for Marilu's — so of 1,663 catalogue products only 71 have ever
 * carried a price. Searching for a steak and being told nothing is known
 * about it is the honest answer, but it is not a useful one when the app can
 * simply go and look.
 *
 * This checks the one product the person asked about, right now, against the
 * same two sources the sweeps use and through the same matching and storage
 * path — so a price found here is indistinguishable from one found by a sweep,
 * and shows up everywhere else in the app afterwards.
 *
 * Bounded on purpose: one Flipp request, and at most a handful of Marilu's
 * page loads. This app serves one household and must not behave like a
 * crawler.
 */

/** Marilu's costs two page fetches per candidate; the rest of the request
 *  budget is left to Flipp and the database round-trips. */
const MARILUS_BUDGET_MS = 20_000;

export type PriceCheckResult = {
  /** Every current price now known for the product, best first. */
  offers: { label: string; priceCents: number }[];
  /**
   * Advertised prices at stores that aren't set up as retailers. Shown, never
   * stored: an observation has to name a real retailer row, but a real ad in a
   * real local flyer is still the answer to "where is this on sale".
   */
  elsewhere: { label: string; priceCents: number }[];
  /** Advertised prices whose flyer starts in the next few days. */
  upcoming: { label: string; priceCents: number }[];
  /** One line for the person: what was found, or plainly that nothing was. */
  message: string;
  /** True when the sources themselves failed, as distinct from finding nothing. */
  failed: boolean;
};

export async function checkProductPrice(
  householdId: string,
  catalogProductId: string,
): Promise<PriceCheckResult> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const observedAt = new Date().toISOString();

  const [{ data: productRow }, { data: retailerRows }, location] = await Promise.all([
    supabase
      .from("catalog_products")
      .select("id, display_name, brand, category, subcategory, search_aliases, default_unit")
      .eq("id", catalogProductId)
      .maybeSingle(),
    supabase.from("retailers").select("id, name, kind"),
    getLocationContext(householdId, supabase),
  ]);

  const product = productRow as unknown as MatchableCatalogProduct | null;
  if (!product) {
    return {
      offers: [],
      elsewhere: [],
      upcoming: [],
      message: "That product is no longer listed.",
      failed: true,
    };
  }
  if (!location.postalCode) {
    return {
      offers: [],
      elsewhere: [],
      upcoming: [],
      message: "Add your postal code in Settings so we know which flyers apply.",
      failed: true,
    };
  }

  const retailers = ((retailerRows ?? []) as KnownRetailer[]).filter((r) => r.id && r.name);
  const catalogById = new Map([[product.id, product]]);
  const found: PriceObservationRecord[] = [];
  let otherStores: UnstoredDeal[] = [];
  let upcomingDeals: UpcomingDeal[] = [];
  let sourcesFailed = 0;
  let sourcesTried = 0;

  // Flyers and the retailers' own website prices — one request carries both.
  sourcesTried += 1;
  try {
    const payload = await searchFlipp(product.display_name, location.postalCode);
    const groups = [{ catalogProductId: product.id, items: parseFlippItems(payload) }];
    const onlineGroups = [{ catalogProductId: product.id, items: parseFlippEcomItems(payload) }];
    otherStores = findDealsAtOtherStores({ groups, retailers, catalogById, today });
    upcomingDeals = findUpcomingDeals({ groups, catalogById, today });
    found.push(
      ...buildFlyerObservations({ groups, retailers, catalogById, today, observedAt }).observations,
      ...buildOnlineObservations({ groups: onlineGroups, retailers, catalogById, observedAt })
        .observations,
    );
  } catch (error) {
    sourcesFailed += 1;
    if (!(error instanceof AdapterError)) throw error;
  }

  // Marilu's, which publishes no flyer and so can only ever be read this way.
  const marilus = retailers.find((r) => r.name === "Marilu's Market");
  if (marilus) {
    sourcesTried += 1;
    const hit = await findAtMarilus({
      query: product.display_name,
      catalogProductId: product.id,
      catalogProduct: product,
      catalog: [product],
      retailerId: marilus.id,
      deadline: Date.now() + MARILUS_BUDGET_MS,
    });
    if (hit === "UNAVAILABLE") sourcesFailed += 1;
    else if (hit && hit !== "NOT_STOCKED") {
      found.push({
        catalogProductId: hit.catalogProductId,
        retailerId: marilus.id,
        retailerLocationId: null,
        externalProductId: hit.productId,
        observedPriceCents: hit.priceCents,
        regularPriceCents: null,
        // A per-pound price is never recorded as a pack price.
        unitPriceText: isWeightPriced(hit.unit) ? hit.priceText : null,
        packageSize: null,
        unit: hit.unit,
        promotionText: null,
        validFrom: null,
        validUntil: null,
        availability: "IN_STOCK",
        sourceUrl: hit.url,
        // Said plainly in the data: a price Instacart lists for the store,
        // which is not necessarily the price on the shelf.
        sourceType: "adapter:instacart",
        matchConfidence: hit.confidence,
        matchMethod: hit.method,
        matchStatus: hit.status,
        rawName: hit.name,
        rawBrand: null,
        imageUrl: hit.imageUrl,
        observedAt,
      });
    }
  }

  const write = await storeObservations(supabase, householdId, found);
  if (!write.ok) {
    return { offers: [], elsewhere: [], upcoming: [], message: write.message, failed: true };
  }

  // Report from everything now on record, not only from what this run added —
  // a price found an hour ago is still the answer, and is deliberately not
  // written twice.
  const { data: priceRows } = await supabase
    .from("retailer_price_observations")
    .select(
      "observed_price_cents, observed_at, valid_until, source_type, raw_name, retailer:retailers(name)",
    )
    .eq("household_id", householdId)
    .eq("catalog_product_id", catalogProductId)
    .order("observed_at", { ascending: false })
    .limit(50);

  type PriceRow = {
    observed_price_cents: number;
    observed_at: string;
    valid_until: string | null;
    source_type: string;
    raw_name: string | null;
    retailer: { name: string } | null;
  };
  const offers: ProductOffer[] = ((priceRows ?? []) as unknown as PriceRow[]).map((row) => ({
    catalogProductId,
    priceCents: row.observed_price_cents,
    retailerName: row.retailer?.name ?? null,
    source: classifySource(row.source_type),
    observedOn: row.observed_at.slice(0, 10),
    validUntil: row.valid_until ? row.valid_until.slice(0, 10) : null,
    coversSeveralItems: isMultiItemOffer(row.raw_name),
  }));

  // One line per store, cheapest first — "where" is the question being asked,
  // so a single overall best price would throw away the answer.
  const byRetailer = new Map<string, ProductOffer>();
  for (const offer of offers) {
    const key = offer.retailerName ?? "";
    const best = bestOfferByProduct(
      [offer, ...(byRetailer.has(key) ? [byRetailer.get(key)!] : [])],
      today,
    ).get(catalogProductId);
    if (best) byRetailer.set(key, best);
  }
  const lines = [...byRetailer.values()]
    .sort((a, b) => a.priceCents - b.priceCents)
    .map((offer) => ({ label: describeOffer(offer, today), priceCents: offer.priceCents }));

  // The same caveat the stored lines carry: a flyer line advertising several
  // products has a real price that may belong to one of the others.
  const mixed = (name: string) => (isMultiItemOffer(name) ? " · ad covers several items" : "");

  const elsewhere = otherStores.map((deal) => ({
    label: `$${(deal.priceCents / 100).toFixed(2)} at ${deal.merchantName}${mixed(deal.name)}`,
    priceCents: deal.priceCents,
  }));

  const upcoming = upcomingDeals.map((deal) => ({
    label: `$${(deal.priceCents / 100).toFixed(2)} at ${deal.merchantName} from ${deal.startsOn}${mixed(deal.name)}`,
    priceCents: deal.priceCents,
  }));

  if (lines.length > 0 || elsewhere.length > 0 || upcoming.length > 0) {
    return { offers: lines, elsewhere, upcoming, message: "", failed: false };
  }
  if (sourcesTried > 0 && sourcesFailed === sourcesTried) {
    return {
      offers: [],
      elsewhere: [],
      upcoming: [],
      message: "Couldn't reach the price sources just now.",
      failed: true,
    };
  }
  return {
    offers: [],
    elsewhere: [],
    upcoming: [],
    message: "No current price at any store we check.",
    failed: false,
  };
}
