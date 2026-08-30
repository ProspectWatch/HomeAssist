import { describe, expect, it } from "vitest";
import seed from "../../../supabase/seed/master-catalogue.json";
import { CATALOG_CATEGORIES, isCatalogCategory, isCatalogSubcategory } from "./categories";
import { normalizeQuery, searchCatalog } from "@/lib/catalog-search";
import { matchReceiptLine } from "@/lib/receipts/matching";
import type { CatalogProduct } from "@/lib/data/catalog";
import type { MatchableCatalogProduct } from "@/lib/retailers/matching";

type SeedProduct = {
  id: string;
  display_name: string;
  category: string;
  subcategory: string;
  search_aliases: string[];
};

const PRODUCTS = seed.products as SeedProduct[];

/** The seed as the app sees it, so search is exercised for real. */
const AS_CATALOG: CatalogProduct[] = PRODUCTS.map(
  (p) =>
    ({
      id: p.id,
      display_name: p.display_name,
      brand: null,
      category: p.category,
      subcategory: p.subcategory,
      search_aliases: p.search_aliases,
    }) as CatalogProduct,
);

describe("catalogue shape", () => {
  it("is a substantial household vocabulary", () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(750);
  });

  it("has no duplicate ids", () => {
    const ids = PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate display names", () => {
    const names = PRODUCTS.map((p) => p.display_name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  // The id is the primary key AND what makes the seed idempotent, so it has to
  // be derivable from the name exactly the way the app derives it.
  it("derives every id from its display name", () => {
    for (const p of PRODUCTS) {
      expect(p.id).toBe(normalizeQuery(p.display_name).replace(/\s+/g, "-"));
    }
  });

  it("files every product under a real category and aisle", () => {
    for (const p of PRODUCTS) {
      expect(isCatalogCategory(p.category), `${p.display_name}: ${p.category}`).toBe(true);
      expect(
        isCatalogSubcategory(p.category, p.subcategory),
        `${p.display_name}: ${p.category} / ${p.subcategory}`,
      ).toBe(true);
    }
  });

  it("covers every category in the taxonomy", () => {
    const used = new Set(PRODUCTS.map((p) => p.category));
    for (const category of CATALOG_CATEGORIES) {
      expect(used.has(category.name), `nothing filed under ${category.name}`).toBe(true);
    }
  });

  // A generic product VOCABULARY: no prices, sizes, UPCs or invented brands.
  it("asserts no price, package size or barcode", () => {
    for (const p of PRODUCTS) {
      expect(p.display_name).not.toMatch(/\$|\bUPC\b|\d{6,}/);
      expect(p.display_name).not.toMatch(/\b\d+\s?(ml|mL|L|g|kg|oz|lb)\b/);
    }
  });

  it("keeps names human-length and non-empty", () => {
    for (const p of PRODUCTS) {
      expect(p.display_name.trim()).toBe(p.display_name);
      expect(p.display_name.length).toBeGreaterThan(1);
      expect(p.display_name.length).toBeLessThanOrEqual(60);
    }
  });

  it("stores aliases normalized, and never one that just repeats the name", () => {
    for (const p of PRODUCTS) {
      for (const alias of p.search_aliases) {
        expect(alias).toBe(normalizeQuery(alias));
        expect(alias).not.toBe(normalizeQuery(p.display_name));
      }
      expect(new Set(p.search_aliases).size).toBe(p.search_aliases.length);
    }
  });

  it("carries a meaningful number of search aliases", () => {
    const total = PRODUCTS.reduce((n, p) => n + p.search_aliases.length, 0);
    expect(total).toBeGreaterThan(200);
  });
});

/* The QA list from the brief: each term must return sensible choices. */
const SEARCH_QA: [term: string, mustInclude: string][] = [
  ["chips", "Potato Chips"],
  ["candy", "Hard Candy"],
  ["chocolate", "Chocolate Bar"],
  ["ice cream", "Vanilla Ice Cream"],
  ["popsicles", "Ice Pops"],
  ["juice", "Apple Juice"],
  ["pop", "Cola"],
  ["milk", "2% Milk"],
  ["lactose free milk", "1% Lactose-Free Milk"],
  ["almond milk", "Unsweetened Almond Milk"],
  ["eggs", "Large Eggs"],
  ["lettuce", "Butter Lettuce"],
  ["peppers", "Mini Sweet Peppers"],
  ["steak", "Flank Steak"],
  ["chicken", "Chicken Breast"],
  ["pork", "Pork Loin Roast"],
  ["salmon", "Salmon Fillet"],
  ["bread", "White Bread"],
  ["bagels", "Everything Bagels"],
  ["pasta", "Whole Wheat Pasta"],
  ["rice", "Basmati Rice"],
  ["tacos", "Taco Shells"],
  ["dishwasher", "Dishwasher Detergent"],
  ["laundry detergent", "Liquid Laundry Detergent"],
  ["garbage bags", "Outdoor Garbage Bags"],
  ["ziploc", "Resealable Bags"],
  ["tin foil", "Heavy Duty Aluminum Foil"],
  ["toilet paper", "Toilet Paper Multipack"],
  ["shampoo", "Dandruff Shampoo"],
];

describe("search and typeahead", () => {
  it.each(SEARCH_QA)("'%s' returns sensible results including %s", (term, expected) => {
    const results = searchCatalog(AS_CATALOG, term, 20);
    expect(results.length, `"${term}" returned nothing`).toBeGreaterThan(0);
    expect(
      results.map((r) => r.display_name),
      `"${term}" missed ${expected}`,
    ).toContain(expected);
  });

  // Canadian household vocabulary must reach the canonical name without
  // replacing it.
  it.each([
    ["pop", "Cola"],
    ["soda", "Club Soda"],
    ["ziploc", "Resealable Bags"],
    ["tin foil", "Heavy Duty Aluminum Foil"],
    ["chicken fingers", "Chicken Tenders"],
    ["fries", "Frozen French Fries"],
    ["hamburger", "Medium Ground Beef"],
    ["coriander", "Fresh Cilantro"],
    ["pierogies", "Frozen Perogies"],
    ["kleenex", "Facial Tissue"],
    ["serviettes", "Napkins"],
    ["freezies", "Ice Pops"],
    ["icing sugar", "Icing Sugar"],
    ["peameal bacon", "Back Bacon"],
  ])("the Canadian term '%s' finds %s", (term, expected) => {
    const names = searchCatalog(AS_CATALOG, term, 20).map((r) => r.display_name);
    expect(names, `"${term}" missed ${expected}`).toContain(expected);
  });

  it("keeps a one-word query fast to act on", () => {
    // Typeahead shows a short list; the best match must be near the top.
    const top = searchCatalog(AS_CATALOG, "chips", 5).map((r) => r.display_name);
    expect(top).toContain("Potato Chips");
  });
});

describe("receipt matching against the expanded catalogue", () => {
  const MATCHABLE: MatchableCatalogProduct[] = PRODUCTS.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    brand: null,
    category: p.category,
    subcategory: p.subcategory,
    search_aliases: p.search_aliases,
    default_unit: null,
  }));

  // Receipt text is abbreviated; a concept-level catalogue is what lets an
  // abbreviation land somewhere sensible at all.
  it.each([
    ["POTATO CHIPS", "potato-chips"],
    ["TORTILLA CHIPS", "tortilla-chips"],
    ["ICE CREAM BARS", "ice-cream-bars"],
    ["FROZEN FRENCH FRIES", "frozen-french-fries"],
    ["CHICKEN NUGGETS", "chicken-nuggets"],
    ["ORANGE JUICE NO PULP", "orange-juice-no-pulp"],
  ])("resolves %s", (raw, expectedId) => {
    const result = matchReceiptLine(raw, MATCHABLE);
    expect(result.catalogProductId).toBe(expectedId);
  });

  it("still refuses to guess on text it cannot read", () => {
    const result = matchReceiptLine("XQZ9 PLU 4011 MISC", MATCHABLE);
    expect(["UNMATCHED", "REVIEW_REQUIRED"]).toContain(result.status);
  });
});
