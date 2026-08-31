import { AdapterError } from "../types";

/**
 * Flyer deal ingestion via Flipp.
 *
 * Flipp is a consumer flyer aggregator: retailers submit their weekly flyers
 * to it for distribution to shoppers, and its search endpoint serves exactly
 * the advertised prices those flyers carry. Reading it is the use it exists
 * for — unlike a retailer's own store API, which refuses automated clients
 * and which this app does not try to impersonate.
 *
 * Everything returned here is an ADVERTISED price with a validity window,
 * not a shelf price we observed ourselves. That distinction is carried all
 * the way through: flyer observations are stored as source_type FLYER and
 * are deliberately kept out of the price book's "usual price", because a
 * sale price is not what the household normally pays.
 */

const SEARCH_ENDPOINT = "https://backflipp.wishabi.com/flipp/items/search";

/**
 * An online shelf price from a retailer's website.
 *
 * Distinct from a FlyerDeal in two ways that matter: there is no validity
 * window (it is today's price, not a dated promotion), and it is not bound to
 * a location — anyone can order it — so it is not filtered by which stores the
 * household shops at.
 */
export type OnlinePrice = {
  merchantName: string;
  name: string;
  priceCents: number;
  /** The pre-sale price when the listing shows one. */
  originalPriceCents: number | null;
  sku: string | null;
  imageUrl: string | null;
};

export type FlyerDeal = {
  merchantName: string;
  name: string;
  priceCents: number;
  /** The pre-sale price, when the flyer prints one. */
  originalPriceCents: number | null;
  /** e.g. "10% OFF", "2 FOR $5" — the flyer's own words, never our summary. */
  saleStory: string | null;
  prePriceText: string | null;
  postPriceText: string | null;
  validFrom: string | null;
  validTo: string | null;
  flyerId: number | null;
  flyerItemId: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
};

type FlippItem = {
  name?: unknown;
  merchant_name?: unknown;
  current_price?: unknown;
  original_price?: unknown;
  sale_story?: unknown;
  pre_price_text?: unknown;
  post_price_text?: unknown;
  valid_from?: unknown;
  valid_to?: unknown;
  flyer_id?: unknown;
  flyer_item_id?: unknown;
  id?: unknown;
  clean_image_url?: unknown;
  clipping_image_url?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Flipp prices are decimal dollars, sometimes as a string. Anything that
 *  isn't a positive number yields null and the item is dropped — a deal with
 *  no readable price is not a deal. */
export function toCents(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** ISO timestamp -> calendar date, or null. */
function toDate(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Parses the flyer items out of a Flipp search payload.
 *
 * Only `items` is read — those are real flyer entries with a merchant and a
 * validity window. `ecom_items` is online marketplace listing data with no
 * flyer behind it and no validity window, so it is deliberately ignored
 * rather than mixed in and presented as a local deal.
 */
export function parseFlippItems(payload: unknown): FlyerDeal[] {
  const items = (payload as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];

  const deals: FlyerDeal[] = [];
  for (const raw of items as FlippItem[]) {
    const name = asString(raw.name);
    const merchantName = asString(raw.merchant_name);
    const priceCents = toCents(raw.current_price);
    if (!name || !merchantName || priceCents === null) continue;

    const flyerId = typeof raw.flyer_id === "number" ? raw.flyer_id : null;
    const flyerItemId = raw.flyer_item_id != null ? String(raw.flyer_item_id) : raw.id != null ? String(raw.id) : null;

    deals.push({
      merchantName,
      name,
      priceCents,
      originalPriceCents: toCents(raw.original_price),
      saleStory: asString(raw.sale_story),
      prePriceText: asString(raw.pre_price_text),
      postPriceText: asString(raw.post_price_text),
      validFrom: toDate(raw.valid_from),
      validTo: toDate(raw.valid_to),
      flyerId,
      flyerItemId,
      imageUrl: asString(raw.clean_image_url) ?? asString(raw.clipping_image_url),
      sourceUrl: flyerId ? `https://flipp.com/en-ca/flyer/${flyerId}` : null,
    });
  }
  return deals;
}

/**
 * Parses the ecommerce listings out of a Flipp search payload.
 *
 * These are website prices — real online shelf prices with SKUs — for the
 * retailers whose catalogues the aggregator carries. They are the only route
 * to website pricing available: every grocery site this household shops at
 * refuses automated clients at the edge, and impersonating a browser to get
 * around that is out of scope.
 */
export function parseFlippEcomItems(payload: unknown): OnlinePrice[] {
  const items = (payload as { ecom_items?: unknown })?.ecom_items;
  if (!Array.isArray(items)) return [];

  const prices: OnlinePrice[] = [];
  for (const raw of items as Record<string, unknown>[]) {
    const name = asString(raw.name);
    // Ecom listings name the retailer in `merchant`; flyer items use
    // `merchant_name`. Different fields, and mixing them up silently
    // attributes a price to the wrong shop.
    const merchantName = asString(raw.merchant);
    const priceCents = toCents(raw.current_price);
    if (!name || !merchantName || priceCents === null) continue;

    prices.push({
      merchantName,
      name,
      priceCents,
      originalPriceCents: toCents(raw.original_price),
      sku: raw.sku != null ? String(raw.sku) : raw.item_id != null ? String(raw.item_id) : null,
      imageUrl: asString(raw.image_url),
    });
  }
  return prices;
}

/** A flyer that has already expired is history, not an offer. */
export function isCurrentlyValid(deal: FlyerDeal, today: string): boolean {
  if (deal.validTo && deal.validTo < today) return false;
  if (deal.validFrom && deal.validFrom > today) return false;
  return true;
}

/** The flyer's own promotional wording, assembled without embellishment.
 *  Returns null when the flyer said nothing beyond the price. */
export function promotionText(deal: FlyerDeal): string | null {
  const parts = [deal.prePriceText, deal.saleStory, deal.postPriceText]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * One search against Flipp. Bounded timeout, no retry against a refusal, and
 * an identified client — this app serves a single household and must never
 * behave like a crawler.
 */
export async function searchFlipp(
  term: string,
  postalCode: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<unknown> {
  const { timeoutMs = 15000, fetchImpl = fetch } = options;
  const postal = postalCode.replace(/\s+/g, "").toUpperCase();
  if (!postal) throw new AdapterError("NOT_CONFIGURED", "No postal code set for this household.");

  const url = `${SEARCH_ENDPOINT}?locale=en-ca&postal_code=${encodeURIComponent(postal)}&q=${encodeURIComponent(term)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-CA",
        "User-Agent": "HomeAssist/1.0 (household grocery assistant; single-household use)",
      },
    });

    if (res.status === 429) throw new AdapterError("RATE_LIMITED", "Flyer search asked us to slow down.");
    if (res.status === 401 || res.status === 403) {
      throw new AdapterError("ACCESS_BLOCKED", "Flyer search denied access.", `HTTP ${res.status}`);
    }
    if (!res.ok) throw new AdapterError("NETWORK_ERROR", "Flyer search failed.", `HTTP ${res.status}`);

    return await res.json();
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AdapterError("NETWORK_ERROR", "Flyer search timed out.");
    }
    throw new AdapterError("NETWORK_ERROR", "Couldn't reach flyer search.", String(error));
  } finally {
    clearTimeout(timer);
  }
}

const UNIT = "(?:g|kg|mg|ml|l|lb|lbs|oz)";
const NUM = "\\d+(?:\\.\\d+)?";

/**
 * One stated package size. Alternation is longest-first on purpose, so a
 * multipack ("16 X 100 G") and a range ("825 G-1.3 KG", "349-510 G") each
 * count as the single size they describe rather than as two.
 */
const SIZE_MENTION = new RegExp(
  `${NUM}\\s*[x×]\\s*${NUM}\\s*${UNIT}\\b` +
    `|${NUM}\\s*${UNIT}?\\s*[-–/]\\s*${NUM}\\s*${UNIT}\\b` +
    `|${NUM}\\s*${UNIT}\\b`,
  "gi",
);

export function countSizeMentions(rawName: string): number {
  return rawName.match(SIZE_MENTION)?.length ?? 0;
}

/**
 * Whether a flyer entry advertises more than one product under one price.
 *
 * Canadian flyers do this constantly — "IÖGO YOGURT OR SIGGI'S SKYR YOGURT",
 * "CARROTS, 2 LB OR PC COLESLAW, 397 G". The price is real, but it may belong
 * to the other half of the offer, so a deal like this is worth listing and
 * not worth attaching a confident "under your usual price" claim to.
 *
 * Two signals, because one is not enough. The separator word catches most of
 * them, but Flipp's own text sometimes drops it — "IÖGO YOGURT 16 X 100 G
 * SIGGI'S SKYR YOGURT 650 - 750 G" is one offer over two products with no
 * "or" anywhere. A second stated package size gives that away.
 *
 * Deliberately biased toward caution: a false positive costs one savings
 * claim on a real deal, which is still listed with its price. A false
 * negative asserts a saving on a product the price may not apply to.
 */
export function isMultiItemOffer(rawName: string | null): boolean {
  if (!rawName) return false;
  if (/\bor\b/i.test(rawName)) return true;
  return countSizeMentions(rawName) >= 2;
}

/** Identity of an offer, for collapsing repeats.
 *
 *  Normalised hard, because chains re-run the same ad with cosmetic
 *  differences — "OÎKOS" and "OIKOS", or the same line with and without a
 *  comma — and those are one deal, not two. */
export function offerKey(deal: FlyerDeal): string {
  const name = deal.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${normalizeMerchantKey(deal.merchantName)}|${name}|${deal.priceCents}|${deal.validTo ?? ""}`;
}

function normalizeMerchantKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Convenience wrapper for callers that only want this week's flyer deals. */
export async function searchFlyerDeals(
  term: string,
  postalCode: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<FlyerDeal[]> {
  return parseFlippItems(await searchFlipp(term, postalCode, options));
}
