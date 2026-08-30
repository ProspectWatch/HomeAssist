import { parsePackageSize, parsePriceToCents, parsePromotionWindow } from "../normalization";
import {
  AdapterError,
  type RetailerAdapter,
  type RetailerLocation,
  type RetailLocationContext,
  type RetailerProductRaw,
} from "../types";

/**
 * Shared implementation for Loblaw-operated banners (Fortinos, No Frills,
 * and later Zehrs/Independent/Real Canadian Superstore), which expose the
 * same public product-facade shape. Fortinos and No Frills keep separate
 * adapter identities but share this normalization and transport so a fix to
 * package-size parsing benefits both (§10).
 */

/** The subset of the public product payload this layer relies on. */
type LoblawProduct = {
  code?: string;
  productId?: string;
  name?: string;
  brand?: string;
  description?: string;
  packageSize?: string;
  link?: string;
  imageAssets?: { smallUrl?: string; mediumUrl?: string; largeUrl?: string }[];
  prices?: {
    price?: { value?: number; unit?: string };
    wasPrice?: { value?: number; unit?: string };
    comparisonPrices?: { value?: number; unit?: string; quantity?: number }[];
  };
  offers?: { badge?: { text?: string }; validFrom?: string; validUntil?: string }[];
  stockStatus?: string;
  categories?: string[];
};

export type LoblawBannerConfig = {
  key: string;
  retailerName: string;
  /** Banner id the public endpoints expect (e.g. "fortinos", "nofrills"). */
  bannerId: string;
  /** Public site origin, used for building canonical product URLs. */
  siteOrigin: string;
};

const API_ORIGIN = "https://api.pcexpress.ca";

/**
 * One polite fetch. Bounded timeout, no retries against a refusal, and a
 * clearly-identified client — this app serves a single household and must
 * never behave like a crawler (§22).
 *
 * A 403 from the retailer's edge is reported as ACCESS_BLOCKED and allowed to
 * propagate. We do not attempt to look like a human browser to get around it:
 * defeating a retailer's bot controls is explicitly out of scope (§9), and a
 * blocked scan must surface as "unavailable" rather than as zero prices (§18).
 */
async function politeFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 15000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-CA",
        "User-Agent": "HomeAssist/1.0 (household grocery assistant; single-household use)",
        ...(rest.headers ?? {}),
      },
    });
    if (res.status === 403 || res.status === 401) {
      throw new AdapterError(
        "ACCESS_BLOCKED",
        "Retailer denied automated access.",
        `HTTP ${res.status} from ${new URL(url).host}`,
      );
    }
    if (res.status === 429) {
      throw new AdapterError("RATE_LIMITED", "Retailer rate-limited the request.", `HTTP 429`);
    }
    if (!res.ok) {
      throw new AdapterError("NETWORK_ERROR", `Retailer returned HTTP ${res.status}.`);
    }
    return res;
  } catch (err) {
    if (err instanceof AdapterError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AdapterError("NETWORK_ERROR", "Retailer request timed out.");
    }
    throw new AdapterError("NETWORK_ERROR", err instanceof Error ? err.message : "Request failed.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Maps a public Loblaw product payload onto RetailerProductRaw.
 *
 * Exported and pure so it can be tested directly against captured fixtures —
 * this is the piece that must keep working when a retailer tweaks its payload.
 */
export function normalizeLoblawProduct(
  product: LoblawProduct,
  config: LoblawBannerConfig,
  ctx: { retailerId: string; retailerLocationId: string | null; observedAt: string },
): RetailerProductRaw | null {
  const externalProductId = product.code ?? product.productId ?? null;
  const name = product.name?.trim();
  if (!externalProductId || !name) return null;

  const currentPriceCents = parsePriceToCents(product.prices?.price?.value ?? null);
  const regularPriceCents = parsePriceToCents(product.prices?.wasPrice?.value ?? null);

  const comparison = product.prices?.comparisonPrices?.[0];
  const unitPriceText =
    comparison?.value != null
      ? `$${comparison.value.toFixed(2)}${comparison.unit ? ` / ${comparison.unit}` : ""}`
      : null;

  const offer = product.offers?.[0];
  const { validFrom, validUntil } = parsePromotionWindow(offer?.validFrom, offer?.validUntil);
  const size = parsePackageSize(product.packageSize ?? null);

  return {
    retailerId: ctx.retailerId,
    retailerLocationId: ctx.retailerLocationId,
    externalProductId,
    url: product.link
      ? new URL(product.link, config.siteOrigin).toString()
      : `${config.siteOrigin}/en/p/${externalProductId}`,
    name,
    brand: product.brand?.trim() || null,
    description: product.description?.trim() || null,
    category: product.categories?.[0] ?? null,
    packageSize: product.packageSize ?? null,
    unit: size.unit,
    currentPriceCents,
    regularPriceCents,
    unitPriceText,
    promotionText: offer?.badge?.text ?? null,
    promotionStart: validFrom,
    promotionEnd: validUntil,
    availability: product.stockStatus ?? null,
    imageUrl: product.imageAssets?.[0]?.mediumUrl ?? product.imageAssets?.[0]?.largeUrl ?? null,
    rawPayload: product,
    observedAt: ctx.observedAt,
  };
}

export function createLoblawBannerAdapter(
  config: LoblawBannerConfig,
  resolveRetailerId: () => string,
): RetailerAdapter {
  const ctxFor = (location: RetailLocationContext) => ({
    retailerId: resolveRetailerId(),
    retailerLocationId: location.preferredStoreLocationId,
    observedAt: new Date().toISOString(),
  });

  return {
    key: config.key,
    retailerName: config.retailerName,

    async searchProducts(query, location) {
      const url = new URL(`${API_ORIGIN}/pcx-bff/api/v1/products/search`);
      url.searchParams.set("term", query);
      url.searchParams.set("banner", config.bannerId);
      url.searchParams.set("lang", "en");
      if (location.externalRetailerLocationId) {
        url.searchParams.set("storeId", location.externalRetailerLocationId);
      }
      if (location.postalCode) url.searchParams.set("postalCode", location.postalCode);

      const res = await politeFetch(url.toString());
      let payload: { results?: LoblawProduct[]; products?: LoblawProduct[] };
      try {
        payload = (await res.json()) as typeof payload;
      } catch {
        throw new AdapterError("PARSE_ERROR", "Retailer response was not valid JSON.");
      }
      const products = payload.results ?? payload.products ?? [];
      const ctx = ctxFor(location);
      return products
        .map((p) => normalizeLoblawProduct(p, config, ctx))
        .filter((p): p is RetailerProductRaw => p !== null);
    },

    async fetchProduct(externalIdOrUrl, location) {
      const id = externalIdOrUrl.includes("/")
        ? (externalIdOrUrl.split("/").pop() ?? externalIdOrUrl)
        : externalIdOrUrl;
      const url = new URL(`${API_ORIGIN}/product-facade/v4/products/${encodeURIComponent(id)}`);
      url.searchParams.set("banner", config.bannerId);
      url.searchParams.set("lang", "en");
      if (location.externalRetailerLocationId) {
        url.searchParams.set("storeId", location.externalRetailerLocationId);
      }

      const res = await politeFetch(url.toString());
      try {
        const product = (await res.json()) as LoblawProduct;
        return normalizeLoblawProduct(product, config, ctxFor(location));
      } catch {
        throw new AdapterError("PARSE_ERROR", "Retailer response was not valid JSON.");
      }
    },

    async fetchLocations(location): Promise<RetailerLocation[]> {
      const url = new URL(`${API_ORIGIN}/pcx-bff/api/v1/pickup-locations`);
      url.searchParams.set("bannerIds", config.bannerId);
      if (location.postalCode) url.searchParams.set("postalCode", location.postalCode);

      const res = await politeFetch(url.toString());
      type RawLocation = {
        id?: string;
        storeId?: string;
        name?: string;
        address?: { line1?: string; town?: string; region?: string; postalCode?: string };
        geoPoint?: { latitude?: number; longitude?: number };
      };
      let payload: { locations?: RawLocation[] };
      try {
        payload = (await res.json()) as typeof payload;
      } catch {
        throw new AdapterError("PARSE_ERROR", "Retailer response was not valid JSON.");
      }
      return (payload.locations ?? [])
        .filter((l) => (l.id ?? l.storeId) && l.name)
        .map((l) => ({
          externalLocationId: (l.id ?? l.storeId)!,
          name: l.name!,
          address: l.address?.line1 ?? null,
          city: l.address?.town ?? null,
          province: l.address?.region ?? null,
          postalCode: l.address?.postalCode ?? null,
          // Only ever what the retailer actually returned — never derived.
          latitude: l.geoPoint?.latitude ?? null,
          longitude: l.geoPoint?.longitude ?? null,
        }));
    },
  };
}
