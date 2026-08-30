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
