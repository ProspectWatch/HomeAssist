import { describe, expect, it } from "vitest";
import { normalizeQuery, searchCatalog } from "./catalog-search";
import type { CatalogProduct } from "./data/catalog";

function product(overrides: Partial<CatalogProduct>): CatalogProduct {
  return {
    id: "test",
    display_name: "Test Product",
    brand: null,
    category: "Pantry",
    subcategory: "Snacks",
    search_aliases: [],
    default_unit: null,
    image_url: null,
    image_ready: false,
    preferred_store_hint: null,
    ...overrides,
  };
}

describe("normalizeQuery", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeQuery("Earth's Own")).toBe("earths own");
    expect(normalizeQuery("Bi-Colour Corn")).toBe("bi colour corn");
  });
});

describe("searchCatalog", () => {
  const products = [
    product({ id: "red-bell-pepper", display_name: "Red Bell Pepper", search_aliases: ["red pepper", "bell pepper"] }),
    product({ id: "green-bell-pepper", display_name: "Green Bell Pepper", search_aliases: ["green pepper", "bell pepper"] }),
    product({ id: "conestoga-eggs", display_name: "Conestoga Brown Free-Range Eggs", brand: "Conestoga", search_aliases: ["brown eggs"] }),
    product({ id: "almond-milk", display_name: "Earth's Own Original Almond Milk", brand: "Earth's Own", search_aliases: ["almond milk"] }),
  ];

  // Ties break toward the shorter, more general name — at catalogue scale a
  // bare category query is reaching for the canonical concept, not whatever
  // happens to sort first alphabetically.
  it("matches on a substring of the alias/name (plural tolerant), shortest first", () => {
    const results = searchCatalog(products, "pep");
    expect(results.map((r) => r.id)).toEqual(["red-bell-pepper", "green-bell-pepper"]);
  });

  it("finds eggs by the singular query", () => {
    const results = searchCatalog(products, "egg");
    expect(results.map((r) => r.id)).toContain("conestoga-eggs");
  });

  it("tolerates apostrophes and punctuation", () => {
    const results = searchCatalog(products, "earths own");
    expect(results.map((r) => r.id)).toContain("almond-milk");
  });

  it("returns nothing for an empty query", () => {
    expect(searchCatalog(products, "   ")).toEqual([]);
  });

  it("ranks a name prefix match above an alias-only match", () => {
    const results = searchCatalog(products, "conestoga");
    expect(results[0]?.id).toBe("conestoga-eggs");
  });
});

describe("searching by brand", () => {
  // What the household actually buys, folded into the same index. Only 12 of
  // 1,663 catalogue products carry a brand, so this is the only place a brand
  // search can find anything.
  const heinz = product({
    id: "ketchup",
    display_name: "Heinz Tomato Ketchup",
    brand: "Heinz",
    isHouseholdProduct: true,
  });
  const hellmanns = product({
    id: "mayonnaise",
    display_name: "Hellmann's Real Mayonnaise",
    brand: "Hellmann's",
    isHouseholdProduct: true,
  });
  const genericKetchup = product({ id: "ketchup-generic", display_name: "Ketchup" });
  const genericMayo = product({ id: "mayo-generic", display_name: "Mayonnaise" });
  const all = [genericKetchup, genericMayo, heinz, hellmanns];

  it("finds a product by its brand alone", () => {
    expect(searchCatalog(all, "heinz").map((p) => p.display_name)).toEqual([
      "Heinz Tomato Ketchup",
    ]);
  });

  it("handles a brand and a product together", () => {
    // The words are never adjacent in that order in any single field, so
    // scoring the query as one token matches nothing at all.
    expect(searchCatalog(all, "heinz ketchup").map((p) => p.display_name)).toEqual([
      "Heinz Tomato Ketchup",
    ]);
  });

  it("copes with an apostrophe in the brand", () => {
    expect(searchCatalog(all, "hellmanns mayonnaise").map((p) => p.display_name)).toEqual([
      "Hellmann's Real Mayonnaise",
    ]);
    expect(searchCatalog(all, "hellmann's").map((p) => p.display_name)).toEqual([
      "Hellmann's Real Mayonnaise",
    ]);
  });

  it("puts the household's own brand above the generic equivalent", () => {
    // Typing "ketchup" should reach for the one in their fridge first.
    expect(searchCatalog(all, "ketchup").map((p) => p.display_name)).toEqual([
      "Heinz Tomato Ketchup",
      "Ketchup",
    ]);
  });

  it("requires every word to match, so a brand does not drag in the rest", () => {
    // "heinz mayonnaise" is not a thing they buy; returning Hellmann's because
    // one word matched would be worse than returning nothing.
    expect(searchCatalog(all, "heinz mayonnaise")).toEqual([]);
  });

  it("keeps a household product's catalogue id, not its own row id", () => {
    // Every caller writes product.id into a catalog_product_id column. Handing
    // back a foreign key from the wrong table corrupts data silently.
    expect(searchCatalog(all, "heinz")[0].id).toBe("ketchup");
  });

  it("still finds generic products when the household owns no brand for them", () => {
    expect(searchCatalog([genericMayo], "mayonnaise").map((p) => p.display_name)).toEqual([
      "Mayonnaise",
    ]);
  });
});
