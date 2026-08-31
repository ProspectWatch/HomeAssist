/**
 * Reading Marilu's Market prices off Instacart's public pages.
 *
 * Marilu's is an independent grocer: it publishes no flyer to Flipp, so the
 * existing scan can never see it, and it had a retailer row with zero prices
 * ever recorded. Its catalogue does exist on Instacart, and this reads it.
 *
 * Three findings from measuring the live site, each of which shapes the code
 * below and none of which was safe to assume:
 *
 *  1. `?retailerSlug=` is genuinely honoured. The same product returns $7.89 at
 *     Marilu's, $7.45 at Fortinos, and nothing at all for a slug that does not
 *     exist or when the parameter is omitted. So a price read from a product
 *     page with the slug set really is that store's price for that product.
 *
 *  2. Search is NOT scoped by that parameter — passing it changes nothing. The
 *     prices on a search page therefore belong to some other retailer, and this
 *     module deliberately throws them away. Search is used only to learn which
 *     product ids exist; every price is re-read from the product page. Taking
 *     the search price would silently file another shop's price under Marilu's.
 *
 *  3. A product Marilu's does not carry renders no price at all. Absence is the
 *     signal for "not stocked", and is never to be filled in with anything.
 *
 * Pure string handling, no network — the fetching lives next door so this can
 * be tested against saved pages.
 */

export const INSTACART_ORIGIN = "https://www.instacart.ca";

/** A product as one of Instacart's cards presents it. */
export type InstacartItem = {
  productId: string;
  slug: string;
  name: string | null;
  priceCents: number | null;
  /** "each (est.)", "per pound", or null for a plain package price. */
  unit: string | null;
  /** The price exactly as the page wrote it, kept for the record. */
  priceText: string | null;
  imageUrl: string | null;
};

export function storefrontUrl(retailerSlug: string): string {
  return `${INSTACART_ORIGIN}/store/${encodeURIComponent(retailerSlug)}/storefront`;
}

export function searchUrl(query: string): string {
  return `${INSTACART_ORIGIN}/store/s?k=${encodeURIComponent(query)}`;
}

export function productUrl(productId: string, slug: string, retailerSlug: string): string {
  return `${INSTACART_ORIGIN}/products/${encodeURIComponent(`${productId}-${slug}`)}?retailerSlug=${encodeURIComponent(retailerSlug)}`;
}

/**
 * "$5.59 per pound" -> 559 cents, unit "per pound".
 *
 * The unit matters and is never dropped: a price per pound is not the price of
 * a package, and treating one as the other would make a shop look cheap or
 * dear by whatever a package happens to weigh.
 */
export function parsePriceText(text: string): { cents: number; unit: string | null } | null {
  const m = /\$([\d,]+(?:\.\d{1,2})?)\s*([^<$]{0,24})?/.exec(text);
  if (!m) return null;
  const cents = Math.round(Number(m[1].replace(/,/g, "")) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  const unit = (m[2] ?? "").trim().replace(/\s+/g, " ") || null;
  return { cents, unit };
}

/** A price quoted by weight or as an estimate is not a package price. */
export function isWeightPriced(unit: string | null): boolean {
  if (!unit) return false;
  return /per\s|\/\s?(lb|kg|g|ml|l)\b|each|est/i.test(unit);
}

const CARD_SPLIT = /data-item-card="true"/;
/** How much of a card's markup to look at. Cards nest, so this is bounded. */
const CARD_WINDOW = 3500;

function cardImage(block: string): string | null {
  const m = /(https:\/\/www\.instacart\.com\/image-server\/\d+x\d+[^"' ]*product-image[^"' ]*)/.exec(
    block,
  );
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, c: string) => String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c: string) => String.fromCodePoint(parseInt(c, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Every product card on a page, with the price the card itself shows.
 *
 * Only ever called on the store's own storefront, where the cards carry that
 * store's prices. Never on a search page — see the note at the top.
 */
export function parseStorefrontCards(html: string, retailerSlug: string): InstacartItem[] {
  const out = new Map<string, InstacartItem>();
  for (const block of html.split(CARD_SPLIT).slice(1)) {
    const win = block.slice(0, CARD_WINDOW);
    const href = new RegExp(
      `href="/products/(\\d+)-([a-z0-9\\-]+)\\?retailerSlug=${retailerSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
    ).exec(win);
    if (!href) continue;
    const priceMatch = /Current price: (\$[\d.,]+[^<]{0,24})/.exec(win);
    const parsed = priceMatch ? parsePriceText(priceMatch[1]) : null;
    const alt = /alt="([^"]{2,120})"/.exec(win);
    const item: InstacartItem = {
      productId: href[1],
      slug: href[2],
      name: alt ? decode(alt[1]) : null,
      priceCents: parsed?.cents ?? null,
      unit: parsed?.unit ?? null,
      priceText: priceMatch ? priceMatch[1].trim() : null,
      imageUrl: cardImage(win),
    };
    // A storefront repeats products across its rows; the first card that
    // carries a price wins so a duplicate cannot blank a good reading.
    const seen = out.get(item.productId);
    if (!seen || (seen.priceCents === null && item.priceCents !== null)) {
      out.set(item.productId, item);
    }
  }
  return [...out.values()];
}

/**
 * Which products a search turned up — ids and names only.
 *
 * The prices on a search page are deliberately not read. Search ignores the
 * retailer parameter, so those prices belong to a different shop, and carrying
 * them through would put another store's price under Marilu's name. Every
 * price this module reports comes from a product page fetched with the slug.
 */
export function parseSearchCandidates(html: string): { productId: string; slug: string; name: string | null }[] {
  const out = new Map<string, { productId: string; slug: string; name: string | null }>();
  for (const block of html.split(CARD_SPLIT).slice(1)) {
    const win = block.slice(0, CARD_WINDOW);
    const href = /href="\/products\/(\d+)-([a-z0-9\-]+)(?:\?[^"]*)?"/.exec(win);
    if (!href) continue;
    const alt = /alt="([^"]{2,120})"/.exec(win);
    if (!out.has(href[1])) {
      out.set(href[1], { productId: href[1], slug: href[2], name: alt ? decode(alt[1]) : null });
    }
  }
  return [...out.values()];
}

/**
 * The store's price for one product, or null when it does not stock it.
 *
 * Null is a real answer and the only honest one for an item the shop does not
 * carry — the page simply renders no price, and nothing is inferred from the
 * rest of it.
 */
export function parseProductPage(html: string): {
  priceCents: number;
  unit: string | null;
  priceText: string;
  imageUrl: string | null;
  name: string | null;
} | null {
  const m = /Current price: (\$[\d.,]+[^<]{0,24})/.exec(html);
  if (!m) return null;
  const parsed = parsePriceText(m[1]);
  if (!parsed) return null;
  const title = /<title>([\s\S]*?)<\/title>/.exec(html);
  return {
    priceCents: parsed.cents,
    unit: parsed.unit,
    priceText: m[1].trim(),
    imageUrl: cardImage(html),
    name: title ? decode(title[1]).replace(/\s*Same-Day Delivery \| Instacart\s*$/i, "").trim() : null,
  };
}
