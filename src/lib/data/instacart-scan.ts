import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getScanTargets, type ScanClient } from "@/lib/data/retailer-scan";
import { matchToCatalog, type MatchableCatalogProduct } from "@/lib/retailers/matching";
import {
  isWeightPriced,
  parseProductPage,
  parseSearchCandidates,
  parseStorefrontCards,
  productUrl,
  searchUrl,
  storefrontUrl,
} from "@/lib/retailers/instacart/parse";
import { fetchPage, pause, REQUEST_PAUSE_MS } from "@/lib/retailers/instacart/fetch";

/**
 * Marilu's Market prices, read from its Instacart listing.
 *
 * Marilu's publishes no flyer to Flipp, so the weekly scan can never see it,
 * and its retailer row had never carried a single price. This fills that gap
 * for the one store the household shops at most and the app knew nothing about.
 *
 * Shaped like the flyer scan on purpose: targeted at the products the household
 * actually cares about right now, bounded, resumable, and honest about what it
 * could not do. Two rules matter more than the rest:
 *
 *  - Every price is re-read from a product page fetched with the retailer slug.
 *    Search prices are another shop's and are thrown away (see parse.ts).
 *  - A price is only stored against a catalogue product the matcher is
 *    confident about. Anything ambiguous is skipped rather than guessed, because
 *    a wrong mapping quietly corrupts price history and every comparison built
 *    on it.
 */

/** Instacart's slug for the store. */
export const MARILUS_SLUG = "marilus-market";
const RETAILER_NAME = "Marilu's Market";

/** Products looked up per run. Small: each one costs two page fetches. */
const MAX_TARGETS = 12;
/** Candidates from a search that are worth re-pricing. */
const MAX_CANDIDATES_PER_TARGET = 4;
/**
 * Wall-clock budget. The serverless function is capped at 60s and a run that
 * overruns stores nothing, so it stops early and says how far it got.
 */
const BUDGET_MS = 40_000;

export type InstacartScanResult =
  | {
      status: "COMPLETE";
      /** Featured products read straight off the storefront. */
      storefrontSeen: number;
      targetsRequested: number;
      totalTargets: number;
      /** Products confirmed stocked at Marilu's with a price. */
      priced: number;
      stored: number;
      /** Looked up and not carried by the store. */
      notStocked: number;
      /** Priced, but by weight — recorded with the unit, never as a pack price. */
      weightPriced: number;
      skippedAmbiguous: number;
    }
  | { status: "FAILED"; message: string };

type MarilusObservation = {
  catalogProductId: string;
  priceCents: number;
  unit: string | null;
  priceText: string;
  name: string | null;
  imageUrl: string | null;
  productId: string;
  url: string;
  confidence: number;
  status: "MATCHED" | "LIKELY_MATCH";
  method: string;
};

/**
 * Looks one product up at Marilu's: search, then re-read the price off the
 * candidate's own product page with the retailer slug.
 *
 * Search prices are another shop's and are thrown away (see parse.ts), so the
 * second fetch is not optional — it is the only price that belongs to this
 * store.
 *
 * "NOT_STOCKED" is an answer: the store doesn't carry it. "UNAVAILABLE" means
 * the fetch itself failed, which is a different thing and must not be reported
 * as an empty shelf.
 */
export async function findAtMarilus(input: {
  query: string;
  catalogProductId: string;
  /** Matched against this alone when known, so a search can't drift onto
   *  a different product. */
  catalogProduct: MatchableCatalogProduct | undefined;
  catalog: MatchableCatalogProduct[];
  retailerId: string;
  /** Epoch ms after which no further requests are made. */
  deadline: number;
}): Promise<MarilusObservation | null | "NOT_STOCKED" | "UNAVAILABLE"> {
  const { query, catalogProductId, catalogProduct, catalog, retailerId, deadline } = input;

  await pause(REQUEST_PAUSE_MS);
  const search = await fetchPage(searchUrl(query));
  if (!search.ok) return "UNAVAILABLE";

  const candidates = parseSearchCandidates(search.html)
    .filter((c) => c.name)
    .slice(0, MAX_CANDIDATES_PER_TARGET);

  let sawCandidate = false;
  for (const candidate of candidates) {
    if (Date.now() > deadline) break;

    // Match on the candidate's name before spending a request on it, so a
    // page is only fetched for something plausibly the right product.
    const match = matchToCatalog(
      {
        retailerId,
        retailerLocationId: null,
        externalProductId: candidate.productId,
        url: productUrl(candidate.productId, candidate.slug, MARILUS_SLUG),
        name: candidate.name!,
        brand: null,
        observedAt: new Date().toISOString(),
      },
      catalogProduct ? [catalogProduct] : catalog,
    );
    if (
      match.catalogProductId !== catalogProductId ||
      (match.status !== "MATCHED" && match.status !== "LIKELY_MATCH")
    ) {
      continue;
    }
    sawCandidate = true;

    await pause(REQUEST_PAUSE_MS);
    const page = await fetchPage(productUrl(candidate.productId, candidate.slug, MARILUS_SLUG));
    if (!page.ok) return "UNAVAILABLE";

    const priced = parseProductPage(page.html);
    if (!priced) continue;

    return {
      catalogProductId,
      priceCents: priced.priceCents,
      unit: priced.unit,
      priceText: priced.priceText,
      name: candidate.name,
      imageUrl: priced.imageUrl,
      productId: candidate.productId,
      url: productUrl(candidate.productId, candidate.slug, MARILUS_SLUG),
      confidence: match.confidence,
      status: match.status,
      method: match.matchMethod,
    };
  }

  // Marilu's does not carry it. That is an answer, not a gap to fill.
  return sawCandidate ? "NOT_STOCKED" : null;
}

/**
 * @param client the scheduled run passes the service-role client. Without it
 * this falls back to the request-scoped one, which in a cron has no session at
 * all — every read would come back empty and every write would be refused by
 * RLS, silently, which is exactly how a scan comes to look like it ran and
 * store nothing.
 */
export async function runInstacartScan(
  householdId: string,
  client?: ScanClient,
): Promise<InstacartScanResult> {
  const supabase = client ?? (await createClient());
  const startedAt = Date.now();
  const spent = () => Date.now() - startedAt;

  const { data: retailer } = await supabase
    .from("retailers")
    .select("id")
    .eq("name", RETAILER_NAME)
    .maybeSingle();
  if (!retailer) {
    return { status: "FAILED", message: `${RETAILER_NAME} isn't set up as a store yet.` };
  }

  const { data: catalogRows } = await supabase
    .from("catalog_products")
    .select("id, display_name, brand, category, subcategory, search_aliases, default_unit")
    .eq("active", true);
  const catalog = (catalogRows ?? []) as unknown as MatchableCatalogProduct[];

  const allTargets = await getScanTargets(householdId, 200, supabase);
  const targets = allTargets.slice(0, MAX_TARGETS);

  type Observation = {
    catalogProductId: string;
    priceCents: number;
    unit: string | null;
    priceText: string;
    name: string | null;
    imageUrl: string | null;
    productId: string;
    url: string;
    confidence: number;
    status: "MATCHED" | "LIKELY_MATCH";
    method: string;
  };
  const observations = new Map<string, Observation>();

  let storefrontSeen = 0;
  let notStocked = 0;
  let skippedAmbiguous = 0;
  let requested = 0;

  // The storefront is one request and yields a few dozen real prices for free,
  // so it always runs first even if the budget then stops everything else.
  const front = await fetchPage(storefrontUrl(MARILUS_SLUG));
  if (!front.ok) return { status: "FAILED", message: front.reason };

  const featured = parseStorefrontCards(front.html, MARILUS_SLUG);
  storefrontSeen = featured.length;
  for (const item of featured) {
    if (item.priceCents === null || !item.name) continue;
    const match = matchToCatalog(
      {
        retailerId: retailer.id,
        retailerLocationId: null,
        externalProductId: item.productId,
        url: productUrl(item.productId, item.slug, MARILUS_SLUG),
        name: item.name,
        brand: null,
        packageSize: item.unit,
        currentPriceCents: item.priceCents,
        observedAt: new Date().toISOString(),
      },
      catalog,
    );
    if (!match.catalogProductId || (match.status !== "MATCHED" && match.status !== "LIKELY_MATCH")) {
      skippedAmbiguous += 1;
      continue;
    }
    observations.set(match.catalogProductId, {
      catalogProductId: match.catalogProductId,
      priceCents: item.priceCents,
      unit: item.unit,
      priceText: item.priceText ?? `$${(item.priceCents / 100).toFixed(2)}`,
      name: item.name,
      imageUrl: item.imageUrl,
      productId: item.productId,
      url: productUrl(item.productId, item.slug, MARILUS_SLUG),
      confidence: match.confidence,
      status: match.status,
      method: match.matchMethod,
    });
  }

  // Then look up the household's own products, one at a time.
  for (const target of targets) {
    if (spent() > BUDGET_MS) break;
    if (observations.has(target.catalogProductId)) continue;
    requested += 1;

    const catalogProduct = catalog.find((c) => c.id === target.catalogProductId);
    const found = await findAtMarilus({
      query: target.query,
      catalogProductId: target.catalogProductId,
      catalogProduct,
      catalog,
      retailerId: retailer.id,
      deadline: startedAt + BUDGET_MS,
    });
    if (found === "UNAVAILABLE") break;
    if (found === "NOT_STOCKED") {
      notStocked += 1;
      continue;
    }
    if (found) observations.set(target.catalogProductId, found);
  }

  const rows = [...observations.values()];
  let stored = 0;
  if (rows.length > 0) {
    const { error } = await supabase.from("retailer_price_observations").upsert(
      rows.map((o) => ({
        household_id: householdId,
        retailer_id: retailer.id,
        catalog_product_id: o.catalogProductId,
        observed_price_cents: o.priceCents,
        // Said plainly in the data, not just in the UI: this is a price
        // Instacart lists for the store, which is not necessarily the price on
        // the shelf. Anything comparing prices can see the difference.
        source_type: "adapter:instacart",
        source_url: o.url,
        external_product_id: o.productId,
        raw_name: o.name,
        unit: o.unit,
        unit_price_text: isWeightPriced(o.unit) ? o.priceText : null,
        image_url: o.imageUrl,
        match_status: o.status,
        match_confidence: o.confidence,
        match_method: o.method,
        availability: "IN_STOCK",
        observed_at: new Date().toISOString(),
      })),
      { ignoreDuplicates: false },
    );
    if (error) return { status: "FAILED", message: error.message };
    stored = rows.length;
  }

  return {
    status: "COMPLETE",
    storefrontSeen,
    targetsRequested: requested,
    totalTargets: allTargets.length,
    priced: rows.length,
    stored,
    notStocked,
    weightPriced: rows.filter((o) => isWeightPriced(o.unit)).length,
    skippedAmbiguous,
  };
}
