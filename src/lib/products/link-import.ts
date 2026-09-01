/**
 * Reading a product out of a shop's own page.
 *
 * Retailers publish their products as machine-readable metadata, for the same
 * reason recipe sites do: it is what puts a picture and a price into a search
 * result or a shared link. So this is a parsing problem, not a guessing one —
 * schema.org/Product JSON-LD first, then Open Graph, then the plain <title>.
 *
 * What it will not do is invent. A page with no price yields no price rather
 * than a number scraped off whatever looked price-shaped; a wish list that
 * quietly reports the wrong price is worse than one that admits it does not
 * know, because somebody budgets against it.
 *
 * Pure string handling — the fetching lives elsewhere so this can be tested
 * against saved pages.
 */

export type ImportedProduct = {
  title: string;
  imageUrl: string | null;
  priceCents: number | null;
  currency: string | null;
  brand: string | null;
  /** The shop's own name for where this came from, e.g. "amazon.ca". */
  siteName: string | null;
  sourceUrl: string;
};

export type ProductImportResult =
  | { ok: true; product: ImportedProduct }
  | { ok: false; message: string };

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, c: string) => String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c: string) => String.fromCodePoint(parseInt(c, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every `<meta property|name="key" content="...">`, either attribute order. */
export function readMetaTags(html: string): Map<string, string> {
  const found = new Map<string, string>();
  const tag = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html))) {
    const el = m[0];
    const key = /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(el);
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(el);
    if (key && content && !found.has(key[1].toLowerCase())) {
      found.set(key[1].toLowerCase(), decode(content[1]));
    }
  }
  return found;
}

/** Every JSON-LD block on the page, parsed, with @graph and arrays flattened. */
export function readJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const block = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = block.exec(html))) {
    try {
      const parsed: unknown = JSON.parse(m[1].trim());
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length > 0) {
        const node = queue.shift();
        if (!node || typeof node !== "object") continue;
        out.push(node);
        const graph = (node as { "@graph"?: unknown })["@graph"];
        if (Array.isArray(graph)) queue.push(...graph);
      }
    } catch {
      // A malformed block is skipped; the others and the meta tags remain.
    }
  }
  return out;
}

function isType(node: unknown, type: string): boolean {
  if (!node || typeof node !== "object") return false;
  const t = (node as { "@type"?: unknown })["@type"];
  if (typeof t === "string") return t.toLowerCase() === type;
  if (Array.isArray(t)) return t.some((v) => typeof v === "string" && v.toLowerCase() === type);
  return false;
}

/**
 * "$1,299.00" and 1299 both become 129900 cents.
 *
 * Returns null rather than 0 for anything unparseable: a wish list showing
 * $0.00 reads as free, which is a specific and wrong claim.
 */
export function parseMoneyToCents(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
  }
  if (typeof value !== "string") return null;
  const m = /-?\d[\d,]*(?:\.\d{1,2})?/.exec(value.replace(/\s/g, ""));
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return decode(value);
    if (Array.isArray(value)) {
      const hit = value.find((v) => typeof v === "string" && v.trim());
      if (typeof hit === "string") return decode(hit);
    }
    if (value && typeof value === "object") {
      const named = (value as { name?: unknown; url?: unknown });
      if (typeof named.name === "string" && named.name.trim()) return decode(named.name);
      if (typeof named.url === "string" && named.url.trim()) return decode(named.url);
    }
  }
  return null;
}

/** Resolves a possibly-relative image URL, and refuses anything not http(s). */
function absoluteImage(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Titles that mean "we think you are a bot", not "this is the product".
 *
 * Found by running this against real shops: Walmart answered a challenge page
 * whose <title> was "Verify Your Identity", and the parser dutifully offered
 * to add a product called Verify Your Identity to a child's wish list. A page
 * that is a bot wall has to fail as one.
 */
const INTERSTITIAL = [
  "verify your identity",
  "are you a robot",
  "are you a human",
  "human verification",
  "security check",
  "access denied",
  "attention required",
  "just a moment",
  "pardon our interruption",
  "captcha",
  "request blocked",
  "unusual traffic",
];

function looksLikeAChallenge(title: string): boolean {
  const t = title.toLowerCase();
  return INTERSTITIAL.some((phrase) => t.includes(phrase));
}

export function parseProductFromHtml(html: string, sourceUrl: string): ProductImportResult {
  const meta = readMetaTags(html);
  const nodes = readJsonLd(html);
  const product = nodes.find((n) => isType(n, "product")) as Record<string, unknown> | undefined;

  const offers = (() => {
    if (!product) return undefined;
    const raw = product.offers;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list.find((o) => o && typeof o === "object") as Record<string, unknown> | undefined;
  })();

  const title =
    firstString(product?.name) ??
    meta.get("og:title") ??
    meta.get("twitter:title") ??
    (() => {
      const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
      return m ? decode(m[1]) : null;
    })();

  if (!title) {
    return {
      ok: false,
      message: "That page doesn't say what the product is. Try the item's own page on the shop's site.",
    };
  }

  if (looksLikeAChallenge(title)) {
    return {
      ok: false,
      message:
        "That shop put a bot check in front of the page instead of the product. Add it by hand, or try the link again from a different shop.",
    };
  }

  const priceCents =
    parseMoneyToCents(offers?.price) ??
    parseMoneyToCents(offers?.lowPrice) ??
    parseMoneyToCents(meta.get("product:price:amount")) ??
    parseMoneyToCents(meta.get("og:price:amount"));

  return {
    ok: true,
    product: {
      title: title.slice(0, 200),
      imageUrl: absoluteImage(
        firstString(product?.image) ?? meta.get("og:image") ?? meta.get("twitter:image") ?? null,
        sourceUrl,
      ),
      priceCents,
      currency:
        firstString(offers?.priceCurrency) ??
        meta.get("product:price:currency") ??
        meta.get("og:price:currency") ??
        null,
      brand: firstString(product?.brand),
      siteName: meta.get("og:site_name") ?? new URL(sourceUrl).hostname.replace(/^www\./, ""),
      sourceUrl,
    },
  };
}
