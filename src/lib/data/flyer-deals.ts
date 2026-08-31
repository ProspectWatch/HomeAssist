import { createClient } from "@/lib/supabase/server";
import { getPriceBook } from "@/lib/data/price-book";
import { assessPrice, type PriceVerdict } from "@/lib/pricing/price-book";
import { isMultiItemOffer } from "@/lib/retailers/flyers/flipp";

/**
 * Live flyer deals: what's actually on sale this week, at the household's own
 * stores, for products it actually buys — each judged against the price book.
 *
 * The judgement is the point. "Chicken breast $3.99 at Food Basics" is a
 * fact; "$1.50 under what you usually pay, ends Wednesday" is a decision.
 * Deals with no price history behind them are still shown, honestly labelled,
 * because a sale on something you buy is worth knowing about even before the
 * book can score it.
 */

export type LiveDeal = {
  id: string;
  catalogProductId: string;
  name: string;
  category: string;
  imageUrl: string | null;
  imageReady: boolean;
  retailerName: string | null;
  priceCents: number;
  regularPriceCents: number | null;
  promotionText: string | null;
  rawName: string | null;
  validUntil: string | null;
  sourceUrl: string | null;
  isRegularBuy: boolean;
  /** MATCHED when the flyer named the product unambiguously; LIKELY_MATCH
   *  when we inferred it from the wording. Surfaced in the UI rather than
   *  hidden — flyers advertise "CARROTS OR YELLOW ONIONS" as one offer, and
   *  the reader should know which part we read. */
  matchStatus: string;
  /** Picture from the flyer or listing itself, when the catalogue has none. */
  offerImageUrl: string | null;
  /** The flyer advertised several products under this price, so which one it
   *  refers to is genuinely uncertain. Surfaced, and reason enough to withhold
   *  a savings claim. */
  isMultiItemOffer: boolean;
  /** Null when the price book has nothing to judge this against. */
  verdict: PriceVerdict | null;
};

/**
 * One product, with every store offering it this week.
 *
 * Deals arrive one row per store, so the same watermelon appeared as three
 * separate cards and the reader had to spot for themselves that one of them
 * was half the price of another. Grouping puts the comparison on the card,
 * which is the entire question a deals page exists to answer.
 */
export type DealGroup = {
  catalogProductId: string;
  name: string;
  category: string;
  imageUrl: string | null;
  imageReady: boolean;
  isRegularBuy: boolean;
  /** Cheapest first. */
  offers: LiveDeal[];
  bestPriceCents: number;
  /** How much the priciest store wants over the cheapest, when more than one
   *  is offering it — the number that says whether choosing matters. */
  spreadCents: number;
  /** The verdict for the cheapest offer, when the price book can judge it. */
  verdict: PriceVerdict | null;
};

/** Groups per-store offers into one entry per product. */
export function groupDeals(deals: LiveDeal[]): DealGroup[] {
  const byProduct = new Map<string, LiveDeal[]>();
  for (const deal of deals) {
    const bucket = byProduct.get(deal.catalogProductId);
    if (bucket) bucket.push(deal);
    else byProduct.set(deal.catalogProductId, [deal]);
  }

  const groups: DealGroup[] = [];
  for (const offers of byProduct.values()) {
    const sorted = [...offers].sort((a, b) => a.priceCents - b.priceCents);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    groups.push({
      catalogProductId: best.catalogProductId,
      name: best.name,
      category: best.category,
      // The catalogue photo is preferred; a flyer's own picture stands in
      // when the catalogue has none, which is most of it today.
      imageUrl: best.imageReady && best.imageUrl ? best.imageUrl : (sorted.find((o) => o.offerImageUrl)?.offerImageUrl ?? null),
      imageReady: Boolean(best.imageReady && best.imageUrl) || sorted.some((o) => o.offerImageUrl),
      isRegularBuy: best.isRegularBuy,
      offers: sorted,
      bestPriceCents: best.priceCents,
      spreadCents: worst.priceCents - best.priceCents,
      verdict: best.verdict,
    });
  }

  return groups.sort(
    (a, b) =>
      Number(b.isRegularBuy) - Number(a.isRegularBuy) ||
      // A real choice between stores leads: that is money on the table.
      Number(b.offers.length > 1) - Number(a.offers.length > 1) ||
      b.spreadCents - a.spreadCents ||
      a.name.localeCompare(b.name),
  );
}

type Row = {
  id: string;
  catalog_product_id: string;
  observed_price_cents: number;
  regular_price_cents: number | null;
  promotion_text: string | null;
  raw_name: string | null;
  valid_until: string | null;
  source_url: string | null;
  observed_at: string;
  match_status: string;
  image_url: string | null;
  retailer: { name: string } | null;
  catalog_product: {
    display_name: string;
    category: string;
    image_url: string | null;
    image_ready: boolean;
  } | null;
};

/** How strongly to lead with a deal. A verdict the book can stand behind
 *  outranks one it can't, and an unscored deal outranks nothing. */
const VERDICT_RANK: Record<string, number> = { BEST_EVER: 0, GOOD: 1, TYPICAL: 3, HIGH: 4 };

/** Unambiguous offers lead; multi-product ones follow. */
function matchRank(deal: LiveDeal): number {
  return deal.isMultiItemOffer ? 1 : 0;
}

const SELECT =
  "id, catalog_product_id, observed_price_cents, regular_price_cents, promotion_text, raw_name, valid_until, source_url, observed_at, match_status, image_url, retailer:retailers(name), catalog_product:catalog_products(display_name, category, image_url, image_ready)";

/**
 * How long a website price is treated as current.
 *
 * Online prices carry no expiry of their own, so one must be chosen rather
 * than left implicit. Two weeks is long enough to survive a gap between scans
 * and short enough that nobody is shown a price that has since moved.
 */
const ONLINE_FRESHNESS_DAYS = 14;

export async function getLiveDeals(householdId: string | null, limit = 120): Promise<LiveDeal[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);

    const [dealRes, prefRes, book] = await Promise.all([
      supabase
        .from("retailer_price_observations")
        .select(SELECT)
        .eq("household_id", householdId)
        .eq("source_type", "FLYER")
        .not("catalog_product_id", "is", null)
        // An expired flyer is history, not an offer. Rows with no end date
        // are kept — some flyers simply don't print one.
        .or(`valid_until.gte.${today},valid_until.is.null`)
        .order("observed_at", { ascending: false })
        .limit(400),
      supabase
        .from("household_product_preferences")
        .select("scope_key")
        .eq("household_id", householdId)
        .eq("scope_type", "product")
        .eq("regular_buy", true),
      getPriceBook(householdId),
    ]);

    const regularBuys = new Set(
      ((prefRes.data ?? []) as { scope_key: string }[]).map((r) => r.scope_key),
    );

    // One deal per product per retailer: the cheapest currently-valid price.
    const best = new Map<string, LiveDeal>();
    for (const row of (dealRes.data ?? []) as unknown as Row[]) {
      if (!row.catalog_product) continue;
      const key = `${row.catalog_product_id}|${row.retailer?.name ?? ""}`;
      const existing = best.get(key);
      if (existing && existing.priceCents <= row.observed_price_cents) continue;

      // A savings claim is only as good as the identification behind it.
      // Flyer text is always more verbose than a catalogue name, so almost
      // every real match lands on LIKELY_MATCH — gating on MATCHED would
      // silence every deal. What genuinely makes a deal uncertain is a flyer
      // advertising several products under one price: the price may belong to
      // the other half of the offer. Those are listed without a verdict.
      const multiItem = isMultiItemOffer(row.raw_name);
      const entry = multiItem ? null : (book.get(row.catalog_product_id) ?? null);
      const verdict = entry ? assessPrice(entry, row.observed_price_cents) : null;

      best.set(key, {
        id: row.id,
        catalogProductId: row.catalog_product_id,
        name: row.catalog_product.display_name,
        category: row.catalog_product.category,
        imageUrl: row.catalog_product.image_url,
        imageReady: row.catalog_product.image_ready,
        retailerName: row.retailer?.name ?? null,
        priceCents: row.observed_price_cents,
        regularPriceCents: row.regular_price_cents,
        promotionText: row.promotion_text,
        rawName: row.raw_name,
        validUntil: row.valid_until,
        sourceUrl: row.source_url,
        isRegularBuy: regularBuys.has(row.catalog_product_id),
        matchStatus: row.match_status,
        offerImageUrl: row.image_url,
        isMultiItemOffer: multiItem,
        verdict,
      });
    }

    return [...best.values()]
      .sort(
        (a, b) =>
          Number(b.isRegularBuy) - Number(a.isRegularBuy) ||
          matchRank(a) - matchRank(b) ||
          (VERDICT_RANK[a.verdict?.code ?? ""] ?? 2) - (VERDICT_RANK[b.verdict?.code ?? ""] ?? 2) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, limit);
  } catch {
    return [];
  }
}

/** When the flyer scan last ran, and how it went. */
export async function getLastFlyerScan(
  householdId: string | null,
): Promise<{ finishedAt: string; status: string; pricesFound: number; error: string | null } | null> {
  if (!householdId) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("scan_jobs")
      .select("finished_at, status, prices_found, error")
      .eq("household_id", householdId)
      .eq("source", "flyer:flipp")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const row = data as { finished_at: string | null; status: string; prices_found: number | null; error: string | null };
    if (!row.finished_at) return null;
    return {
      finishedAt: row.finished_at,
      status: row.status,
      pricesFound: row.prices_found ?? 0,
      error: row.error,
    };
  } catch {
    return null;
  }
}

/**
 * Current website prices, judged the same way flyer deals are.
 *
 * Kept separate from flyer deals on purpose: a website price is what a
 * retailer charges today, not a dated promotion, and presenting one under
 * "on sale this week" would claim a saving nobody advertised.
 */
export async function getOnlinePrices(householdId: string | null, limit = 30): Promise<LiveDeal[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - ONLINE_FRESHNESS_DAYS * 86400000).toISOString();

    const [priceRes, prefRes, book] = await Promise.all([
      supabase
        .from("retailer_price_observations")
        .select(SELECT)
        .eq("household_id", householdId)
        .eq("source_type", "ONLINE")
        .not("catalog_product_id", "is", null)
        .gte("observed_at", since)
        .order("observed_at", { ascending: false })
        .limit(400),
      supabase
        .from("household_product_preferences")
        .select("scope_key")
        .eq("household_id", householdId)
        .eq("scope_type", "product")
        .eq("regular_buy", true),
      getPriceBook(householdId),
    ]);

    const regularBuys = new Set(
      ((prefRes.data ?? []) as { scope_key: string }[]).map((r) => r.scope_key),
    );

    const best = new Map<string, LiveDeal>();
    for (const row of (priceRes.data ?? []) as unknown as Row[]) {
      if (!row.catalog_product) continue;
      const key = `${row.catalog_product_id}|${row.retailer?.name ?? ""}`;
      const existing = best.get(key);
      if (existing && existing.priceCents <= row.observed_price_cents) continue;

      const multiItem = isMultiItemOffer(row.raw_name);
      const entry = multiItem ? null : (book.get(row.catalog_product_id) ?? null);

      best.set(key, {
        id: row.id,
        catalogProductId: row.catalog_product_id,
        name: row.catalog_product.display_name,
        category: row.catalog_product.category,
        imageUrl: row.catalog_product.image_url,
        imageReady: row.catalog_product.image_ready,
        retailerName: row.retailer?.name ?? null,
        priceCents: row.observed_price_cents,
        regularPriceCents: row.regular_price_cents,
        promotionText: null,
        rawName: row.raw_name,
        validUntil: null,
        sourceUrl: row.source_url,
        isRegularBuy: regularBuys.has(row.catalog_product_id),
        matchStatus: row.match_status,
        offerImageUrl: row.image_url,
        isMultiItemOffer: multiItem,
        verdict: entry ? assessPrice(entry, row.observed_price_cents) : null,
      });
    }

    return [...best.values()]
      .sort(
        (a, b) =>
          Number(b.isRegularBuy) - Number(a.isRegularBuy) ||
          matchRank(a) - matchRank(b) ||
          (VERDICT_RANK[a.verdict?.code ?? ""] ?? 2) - (VERDICT_RANK[b.verdict?.code ?? ""] ?? 2) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, limit);
  } catch {
    return [];
  }
}
