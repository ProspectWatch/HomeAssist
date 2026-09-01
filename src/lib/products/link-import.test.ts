import { describe, expect, it } from "vitest";
import {
  parseMoneyToCents,
  parseProductFromHtml,
  readJsonLd,
  readMetaTags,
} from "./link-import";

const SRC = "https://shop.example.com/toys/lego-set-42158";

function page(parts: { jsonLd?: unknown; meta?: Record<string, string>; title?: string }): string {
  const meta = Object.entries(parts.meta ?? {})
    .map(([k, v]) => `<meta property="${k}" content="${v}">`)
    .join("");
  const ld = parts.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(parts.jsonLd)}</script>`
    : "";
  return `<html><head><title>${parts.title ?? ""}</title>${meta}${ld}</head><body></body></html>`;
}

describe("parseMoneyToCents", () => {
  it("reads a plain number", () => {
    expect(parseMoneyToCents(12.99)).toBe(1299);
  });

  it("reads a formatted string", () => {
    expect(parseMoneyToCents("$1,299.00")).toBe(129900);
  });

  it("returns null rather than zero for nonsense", () => {
    // A wish list showing $0.00 reads as "free", which is a wrong claim.
    expect(parseMoneyToCents("Call for price")).toBeNull();
    expect(parseMoneyToCents(0)).toBeNull();
    expect(parseMoneyToCents(undefined)).toBeNull();
  });
});

describe("readMetaTags", () => {
  it("reads either attribute order and both property and name", () => {
    const tags = readMetaTags(
      `<meta content="A Thing" property="og:title"><meta name="twitter:image" content="https://x/y.jpg">`,
    );
    expect(tags.get("og:title")).toBe("A Thing");
    expect(tags.get("twitter:image")).toBe("https://x/y.jpg");
  });

  it("decodes entities", () => {
    expect(readMetaTags(`<meta property="og:title" content="LEGO&#174; Technic">`).get("og:title")).toBe(
      "LEGO® Technic",
    );
  });
});

describe("readJsonLd", () => {
  it("flattens @graph", () => {
    const nodes = readJsonLd(page({ jsonLd: { "@graph": [{ "@type": "Product", name: "X" }] } }));
    expect(nodes.some((n) => (n as { name?: string }).name === "X")).toBe(true);
  });

  it("survives one malformed block", () => {
    const html = `<script type="application/ld+json">{not json</script>${page({
      jsonLd: { "@type": "Product", name: "Good" },
    })}`;
    expect(readJsonLd(html).some((n) => (n as { name?: string }).name === "Good")).toBe(true);
  });
});

describe("parseProductFromHtml", () => {
  it("reads a schema.org Product", () => {
    const result = parseProductFromHtml(
      page({
        jsonLd: {
          "@type": "Product",
          name: "LEGO Technic Ferrari",
          image: "https://cdn.example.com/lego.jpg",
          brand: { "@type": "Brand", name: "LEGO" },
          offers: { "@type": "Offer", price: "249.99", priceCurrency: "CAD" },
        },
      }),
      SRC,
    );
    expect(result.ok && result.product).toMatchObject({
      title: "LEGO Technic Ferrari",
      imageUrl: "https://cdn.example.com/lego.jpg",
      priceCents: 24999,
      currency: "CAD",
      brand: "LEGO",
    });
  });

  it("falls back to Open Graph when there is no JSON-LD", () => {
    const result = parseProductFromHtml(
      page({
        meta: {
          "og:title": "Nintendo Switch 2",
          "og:image": "https://cdn.example.com/switch.png",
          "product:price:amount": "529.99",
          "product:price:currency": "CAD",
          "og:site_name": "Best Buy",
        },
      }),
      SRC,
    );
    expect(result.ok && result.product).toMatchObject({
      title: "Nintendo Switch 2",
      priceCents: 52999,
      siteName: "Best Buy",
    });
  });

  it("reports no price rather than inventing one", () => {
    const result = parseProductFromHtml(page({ meta: { "og:title": "Some Bike" } }), SRC);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.priceCents).toBeNull();
      expect(result.product.title).toBe("Some Bike");
    }
  });

  it("resolves a relative image against the page", () => {
    const result = parseProductFromHtml(
      page({ meta: { "og:title": "Thing", "og:image": "/img/thing.jpg" } }),
      SRC,
    );
    expect(result.ok && result.product.imageUrl).toBe("https://shop.example.com/img/thing.jpg");
  });

  it("refuses an image that is not http(s)", () => {
    // A javascript: or data: URL has no business in an <img src> we render.
    const result = parseProductFromHtml(
      page({ meta: { "og:title": "Thing", "og:image": "javascript:alert(1)" } }),
      SRC,
    );
    expect(result.ok && result.product.imageUrl).toBeNull();
  });

  it("names the site from the host when the page does not", () => {
    const result = parseProductFromHtml(page({ meta: { "og:title": "Thing" } }), SRC);
    expect(result.ok && result.product.siteName).toBe("shop.example.com");
  });

  it("refuses a bot-challenge page instead of naming a product after it", () => {
    // Walmart really did answer with this, and the parser really did offer
    // "Verify Your Identity" as a product to put on a child's wish list.
    const result = parseProductFromHtml(page({ title: "Verify Your Identity" }), SRC);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("bot check");
  });

  it("catches the other common challenge wordings", () => {
    for (const title of ["Just a moment...", "Access Denied", "Attention Required! | Cloudflare"]) {
      expect(parseProductFromHtml(page({ title }), SRC).ok).toBe(false);
    }
  });

  it("does not mistake a real product for a challenge", () => {
    const result = parseProductFromHtml(page({ title: "Security Camera 4K" }), SRC);
    expect(result.ok).toBe(true);
  });

  it("fails honestly when the page names no product", () => {
    const result = parseProductFromHtml("<html><body>hello</body></html>", SRC);
    expect(result.ok).toBe(false);
  });

  it("prefers the product's own name over the page title", () => {
    const result = parseProductFromHtml(
      page({ title: "Shop | Everything", jsonLd: { "@type": "Product", name: "Real Name" } }),
      SRC,
    );
    expect(result.ok && result.product.title).toBe("Real Name");
  });
});
