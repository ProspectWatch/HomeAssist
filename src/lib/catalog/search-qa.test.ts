import { describe, expect, it } from "vitest";
import master from "../../../supabase/seed/master-catalogue.json";
import legacy from "../../../supabase/seed/legacy-catalogue.json";
import { searchCatalog } from "@/lib/catalog-search";
import type { CatalogProduct } from "@/lib/data/catalog";

/**
 * Search QA over the WHOLE catalogue, not just the seed — the legacy fixture
 * carries the rows that predate it, so this is the 1,667 products production
 * actually holds. A query that returns nothing, or that buries the canonical
 * concept below the fold, is a real failure for typeahead on a phone.
 */
const CATALOG: CatalogProduct[] = [...master.products, ...legacy.products].map(
  (p) =>
    ({
      id: p.id,
      display_name: p.display_name,
      brand: null,
      category: "category" in p ? p.category : "",
      subcategory: "subcategory" in p ? p.subcategory : null,
      search_aliases: p.search_aliases,
    }) as CatalogProduct,
);

/** What a person sees before scrolling. */
const VISIBLE = 8;

/** [query, a canonical result that must appear in the visible list] */
const QA: [string, string][] = [
  ["chips", "Potato Chips"],
  ["bbq chips", "BBQ Chips"],
  ["all dressed", "All Dressed Chips"],
  ["ketchup chips", "Ketchup Chips"],
  ["pretzels", "Pretzels"],
  ["popcorn", "Popcorn"],
  ["crackers", "Soda Crackers"],
  ["cookies", "Oatmeal Cookies"],
  ["candy", "Hard Candy"],
  ["gummies", "Gummy Candy"],
  ["chocolate", "Chocolate Bar"],
  ["ice cream", "Ice Cream"],
  ["gelato", "Gelato"],
  ["popsicles", "Popsicles"],
  ["frozen pizza", "Frozen Pizza"],
  ["french fries", "French Fries"],
  ["juice", "Apple Juice"],
  ["juice boxes", "Juice Boxes"],
  ["pop", "Cola"],
  ["cola", "Cola"],
  ["sports drink", "Sports Drink"],
  ["coffee", "Coffee"],
  ["milk", "2% Milk"],
  ["lactose free milk", "1% Lactose-Free Milk"],
  ["almond milk", "Almond Milk"],
  ["eggs", "Large Eggs"],
  ["cheddar", "Shredded Cheddar"],
  ["lettuce", "Iceberg Lettuce"],
  ["tomatoes", "Tomatoes"],
  ["peppers", "Bell Peppers"],
  ["onion", "Red Onion"],
  ["potatoes", "Potatoes"],
  ["bananas", "Bananas"],
  ["berries", "Frozen Berries"],
  ["steak", "Flank Steak"],
  ["striploin", "Striploin Steak"],
  ["ground beef", "Ground Beef"],
  ["chicken", "Chicken Breast"],
  ["pork", "Pork Ribs"],
  ["salmon", "Salmon Fillet"],
  ["shrimp", "Shrimp"],
  ["bread", "White Bread"],
  ["bagels", "Bagels"],
  ["tortillas", "Tortillas"],
  ["pasta", "Pasta"],
  ["rice", "Rice"],
  ["cereal", "Breakfast Cereal"],
  ["tacos", "Taco Kit"],
  ["ketchup", "Ketchup"],
  ["bbq sauce", "Barbecue Sauce"],
  ["olive oil", "Olive Oil"],
  ["dishwasher pods", "Dishwasher Pods"],
  ["laundry detergent", "Laundry Detergent"],
  ["garbage bags", "Garbage Bags"],
  ["ziploc", "Ziploc Bags"],
  ["tin foil", "Aluminum Foil"],
  ["toilet paper", "Toilet Paper"],
  ["paper towel", "Paper Towels"],
  ["shampoo", "Shampoo"],
  ["toothpaste", "Toothpaste"],
  ["dog food", "Dog Food"],
  ["cat food", "Dry Cat Food"],
];

describe("search QA across the whole catalogue", () => {
  it("holds every product production holds", () => {
    expect(CATALOG).toHaveLength(1663);
    expect(new Set(CATALOG.map((p) => p.id)).size).toBe(1663);
  });

  it.each(QA)("'%s' surfaces %s without scrolling", (query, expected) => {
    const results = searchCatalog(CATALOG, query, VISIBLE);
    expect(results.length, `"${query}" returned nothing`).toBeGreaterThan(0);
    expect(
      results.map((r) => r.display_name),
      `"${query}" did not surface ${expected} in the first ${VISIBLE}`,
    ).toContain(expected);
  });

  // A broad head-noun query has more good answers than fit on screen, so the
  // contract is "the common ones are there", not one privileged winner.
  it("puts the everyday milks and cuts of chicken in reach", () => {
    const milk = searchCatalog(CATALOG, "milk", 20).map((r) => r.display_name);
    for (const kind of ["2% Milk", "1% Milk", "Skim Milk", "Whole Milk"]) {
      expect(milk, kind).toContain(kind);
    }
    const chicken = searchCatalog(CATALOG, "chicken", 20).map((r) => r.display_name);
    for (const cut of ["Chicken Breast", "Chicken Thighs", "Chicken Wings"]) {
      expect(chicken, cut).toContain(cut);
    }
  });

  it("returns several options for a broad category term", () => {
    for (const term of ["chips", "milk", "cheese", "juice", "bread", "chicken"]) {
      expect(searchCatalog(CATALOG, term, 20).length, term).toBeGreaterThanOrEqual(5);
    }
  });

  // Hierarchy: a specific variant stays reachable from the general term and
  // from its own distinguishing word.
  it("keeps BBQ Potato Chips reachable from both directions", () => {
    for (const term of ["chips", "bbq chips", "barbecue chips", "bbq"]) {
      const names = searchCatalog(CATALOG, term, 20).map((r) => r.display_name);
      expect(names.some((n) => n.includes("BBQ")), term).toBe(true);
    }
  });

  it("never returns a result for gibberish", () => {
    for (const junk of ["qqqqzzz", "zzzzzzzz", "xkcdvbnm"]) {
      expect(searchCatalog(CATALOG, junk, 10)).toHaveLength(0);
    }
  });
});
