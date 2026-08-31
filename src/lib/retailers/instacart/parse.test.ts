import { describe, expect, it } from "vitest";
import {
  isWeightPriced,
  parsePriceText,
  parseProductPage,
  parseSearchCandidates,
  parseStorefrontCards,
  productUrl,
  searchUrl,
} from "./parse";

/** Shaped like the live markup, trimmed to what the parser looks at. */
function card(opts: {
  id: string;
  slug: string;
  store?: string;
  name?: string;
  price?: string;
  image?: boolean;
}): string {
  const store = opts.store ?? "marilus-market";
  return (
    `<div data-item-card="true"><div aria-label="Product" role="group">` +
    `<a role="button" href="/products/${opts.id}-${opts.slug}?retailerSlug=${store}">` +
    (opts.image
      ? `<img alt="${opts.name ?? ""}" src="https://www.instacart.com/image-server/288x288/filters:fill(FFFFFF,true)/d2lnr5mha7bycj.cloudfront.net/product-image/file/large_abc.jpg"/>`
      : `<img alt="${opts.name ?? ""}"/>`) +
    (opts.price ? `<span class="screen-reader-only">Current price: ${opts.price}</span>` : "") +
    `</a></div></div>`
  );
}

describe("parsePriceText", () => {
  it("reads a plain package price", () => {
    expect(parsePriceText("$12.39")).toEqual({ cents: 1239, unit: null });
  });

  it("keeps the unit on a weight price", () => {
    expect(parsePriceText("$5.59 per pound")).toEqual({ cents: 559, unit: "per pound" });
  });

  it("keeps the estimate marker", () => {
    expect(parsePriceText("$0.66 each (est.)")).toEqual({ cents: 66, unit: "each (est.)" });
  });

  it("handles thousands separators", () => {
    expect(parsePriceText("$1,299.00")).toEqual({ cents: 129900, unit: null });
  });

  it("returns null for text with no price", () => {
    expect(parsePriceText("Item Unavailable")).toBeNull();
  });

  it("refuses a zero price rather than recording one", () => {
    expect(parsePriceText("$0.00")).toBeNull();
  });
});

describe("isWeightPriced", () => {
  it("flags per-weight and estimated prices", () => {
    expect(isWeightPriced("per pound")).toBe(true);
    expect(isWeightPriced("each (est.)")).toBe(true);
    expect(isWeightPriced("/ lb")).toBe(true);
  });

  it("leaves a package price alone", () => {
    expect(isWeightPriced(null)).toBe(false);
  });
});

describe("parseStorefrontCards", () => {
  const html =
    card({ id: "2748189", slug: "banana-each", name: "Banana", price: "$0.66 each (est.)", image: true }) +
    card({ id: "28092877", slug: "marilu-s-market-fruit-salad-450-g", name: "Marilu&#x27;s Fruit Salad", price: "$12.39", image: true }) +
    // A card for a different store must not be read as this store's.
    card({ id: "999", slug: "other-store-item", store: "fortinos", name: "Elsewhere", price: "$1.00" });

  it("reads name, price, unit and image from each card", () => {
    const items = parseStorefrontCards(html, "marilus-market");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      productId: "2748189",
      name: "Banana",
      priceCents: 66,
      unit: "each (est.)",
    });
    expect(items[0].imageUrl).toContain("product-image");
  });

  it("decodes entities in the name", () => {
    const items = parseStorefrontCards(html, "marilus-market");
    expect(items[1].name).toBe("Marilu's Fruit Salad");
  });

  it("ignores cards belonging to another retailer", () => {
    const items = parseStorefrontCards(html, "marilus-market");
    expect(items.some((i) => i.productId === "999")).toBe(false);
  });

  it("does not let a later priceless duplicate blank a good reading", () => {
    const dupes =
      card({ id: "5", slug: "x", name: "Thing", price: "$3.00" }) +
      card({ id: "5", slug: "x", name: "Thing" });
    const items = parseStorefrontCards(dupes, "marilus-market");
    expect(items).toHaveLength(1);
    expect(items[0].priceCents).toBe(300);
  });
});

describe("parseSearchCandidates", () => {
  // Measured against the live site: passing retailerSlug to search changes
  // nothing, so these prices are some other shop's and must not be carried.
  const html =
    card({ id: "17875005", slug: "heinz-tomato-ketchup-1-l", name: "Heinz Tomato Ketchup", price: "$4.97" }) +
    card({ id: "18625940", slug: "no-name-tomato-ketchup", name: "No Name Tomato Ketchup", price: "$3.79" });

  it("returns ids and names", () => {
    const found = parseSearchCandidates(html);
    expect(found.map((c) => c.productId)).toEqual(["17875005", "18625940"]);
    expect(found[0].name).toBe("Heinz Tomato Ketchup");
  });

  it("carries no price at all, because a search price is another store's", () => {
    const found = parseSearchCandidates(html);
    for (const candidate of found) {
      expect(Object.keys(candidate)).toEqual(["productId", "slug", "name"]);
    }
  });
});

describe("parseProductPage", () => {
  it("reads the store's price for a product it stocks", () => {
    const html =
      `<title>Marilu&#x27;s Market Maple Leaf Black Forest Ham Same-Day Delivery | Instacart</title>` +
      `<span class="screen-reader-only">Current price: $8.99</span>`;
    const parsed = parseProductPage(html);
    expect(parsed?.priceCents).toBe(899);
    expect(parsed?.name).toBe("Marilu's Market Maple Leaf Black Forest Ham");
  });

  it("returns null when the store does not stock it, rather than inferring one", () => {
    // A product page for an unstocked item renders no price. Absence is the
    // answer; nothing on the rest of the page stands in for it.
    const html = `<title>Something | Instacart</title><div>Item Unavailable</div>`;
    expect(parseProductPage(html)).toBeNull();
  });
});

describe("urls", () => {
  it("scopes a product url to the retailer, which is what makes the price theirs", () => {
    expect(productUrl("2748189", "banana-each", "marilus-market")).toBe(
      "https://www.instacart.ca/products/2748189-banana-each?retailerSlug=marilus-market",
    );
  });

  it("escapes a search query", () => {
    expect(searchUrl("heinz ketchup")).toContain("k=heinz%20ketchup");
  });
});
