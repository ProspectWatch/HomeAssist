import { describe, expect, it } from "vitest";
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_NAMES,
  isCatalogCategory,
  subcategoriesFor,
} from "./categories";
import {
  HOUSEHOLD_PRODUCT_SOURCE,
  buildNewCatalogProduct,
  slugifyProductId,
  uniqueProductId,
  validateNewProduct,
} from "./new-product";
import { mapCatalogCategoryToGroceryCategory } from "@/lib/grocery-categories";
import { searchCatalog } from "@/lib/catalog-search";
import type { CatalogProduct } from "@/lib/data/catalog";

describe("catalogue taxonomy", () => {
  it("has no duplicate category names", () => {
    expect(new Set(CATALOG_CATEGORY_NAMES).size).toBe(CATALOG_CATEGORY_NAMES.length);
  });

  it("keeps every category the seeded library already uses", () => {
    // Dropping one would strand every product filed under it.
    for (const existing of [
      "Produce",
      "Household",
      "Pantry",
      "Meat & Seafood",
      "Dairy & Eggs",
      "Frozen",
      "Drinks",
      "Deli & Prepared",
    ]) {
      expect(isCatalogCategory(existing)).toBe(true);
    }
  });

  it("covers the aisles the Fortinos receipt had nowhere to file", () => {
    expect(isCatalogCategory("Snacks")).toBe(true);
    expect(isCatalogCategory("Confectionery")).toBe(true);
    expect(subcategoriesFor("Snacks")).toContain("Chips");
    expect(subcategoriesFor("Confectionery")).toContain("Fruit Snacks");
    expect(subcategoriesFor("Frozen")).toContain("Frozen Dessert");
    expect(subcategoriesFor("Drinks")).toContain("Soft Drinks");
  });

  it("rejects a category that isn't in the taxonomy", () => {
    expect(isCatalogCategory("Sundries")).toBe(false);
    expect(subcategoriesFor("Sundries")).toEqual([]);
  });

  // The bug this taxonomy exists to prevent: a category known to the product
  // library but missing from the grocery list, silently landing in "Other".
  it("files every category into a real grocery-list section", () => {
    for (const category of CATALOG_CATEGORIES) {
      expect(mapCatalogCategoryToGroceryCategory(category.name)).toBe(category.groceryCategory);
    }
    expect(mapCatalogCategoryToGroceryCategory("Snacks")).toBe("Pantry");
    expect(mapCatalogCategoryToGroceryCategory("Nonexistent")).toBe("Other");
  });

  it("gives every category a unique sort order, mirroring the database", () => {
    const orders = CATALOG_CATEGORIES.map((c) => c.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
    // The eight seeded categories keep the sort_order they already have in
    // product_categories; renumbering them would reshuffle Browse.
    expect(CATALOG_CATEGORIES.find((c) => c.name === "Produce")!.sortOrder).toBe(0);
    expect(CATALOG_CATEGORIES.find((c) => c.name === "Household")!.sortOrder).toBe(7);
    // New ones are appended after, never interleaved.
    for (const added of ["Bakery", "Snacks", "Confectionery", "Health & Beauty", "Baby & Kids", "Pet"]) {
      expect(CATALOG_CATEGORIES.find((c) => c.name === added)!.sortOrder).toBeGreaterThan(7);
    }
  });

  it("keeps every subcategory the seeded library already uses", () => {
    // These are live FK targets — dropping one would orphan real products.
    for (const existing of ["Leafy Greens", "Vegetables", "Fruit"]) {
      expect(subcategoriesFor("Produce")).toContain(existing);
    }
    expect(subcategoriesFor("Dairy & Eggs")).toContain("Milk");
    expect(subcategoriesFor("Frozen")).toContain("Frozen Dessert");
    expect(subcategoriesFor("Pantry")).toContain("Soup & Broth");
    expect(subcategoriesFor("Household")).toContain("Dishwashing");
  });

  it("gives the kitchen walk a strict order with no ties", () => {
    const orders = CATALOG_CATEGORIES.map((c) => c.kitchenOrder).filter(
      (o): o is number => o !== null,
    );
    expect(new Set(orders).size).toBe(orders.length);
    // Non-kitchen aisles stay out of the pantry walk entirely.
    expect(CATALOG_CATEGORIES.find((c) => c.name === "Household")!.kitchenOrder).toBeNull();
    expect(CATALOG_CATEGORIES.find((c) => c.name === "Pet")!.kitchenOrder).toBeNull();
  });

  it("gives every category at least one subcategory to file under", () => {
    for (const category of CATALOG_CATEGORIES) {
      expect(category.subcategories.length).toBeGreaterThan(0);
    }
  });
});

describe("product ids", () => {
  it("slugs a display name the way the seeded library does", () => {
    expect(slugifyProductId("Mini Cucumbers")).toBe("mini-cucumbers");
    expect(slugifyProductId("Lay's Old Fashioned BBQ Chips")).toBe("lays-old-fashioned-bbq-chips");
    expect(slugifyProductId("Natrel 2% Lactose Free Milk")).toBe("natrel-2-lactose-free-milk");
  });

  it("only suffixes when the plain slug is taken", () => {
    expect(uniqueProductId("Rainbow Strips", [])).toBe("rainbow-strips");
    expect(uniqueProductId("Rainbow Strips", ["rainbow-strips"])).toBe("rainbow-strips-2");
    expect(uniqueProductId("Rainbow Strips", ["rainbow-strips", "rainbow-strips-2"])).toBe(
      "rainbow-strips-3",
    );
  });
});

describe("validating a new product", () => {
  it("accepts a named product in a real category", () => {
    expect(validateNewProduct({ displayName: "Rainbow Strips", category: "Confectionery" })).toEqual({
      ok: true,
    });
  });

  it.each([
    ["an empty name", { displayName: "  ", category: "Snacks" }],
    ["a one-character name", { displayName: "x", category: "Snacks" }],
    ["a name with no letters or digits", { displayName: "!!!!", category: "Snacks" }],
    ["no category", { displayName: "Rainbow Strips", category: "" }],
    ["an invented category", { displayName: "Rainbow Strips", category: "Sundries" }],
  ])("refuses %s", (_label, input) => {
    expect(validateNewProduct(input).ok).toBe(false);
  });

  it("refuses a subcategory that isn't under the chosen category", () => {
    // (category, subcategory) is a foreign key — catching it here turns a raw
    // constraint violation into something a person can act on.
    const result = validateNewProduct({
      displayName: "Rainbow Strips",
      category: "Confectionery",
      subcategory: "Frozen Dessert",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a real category/aisle pair, and no aisle at all", () => {
    expect(
      validateNewProduct({ displayName: "Lay's BBQ", category: "Snacks", subcategory: "Chips" }).ok,
    ).toBe(true);
    expect(validateNewProduct({ displayName: "Lay's BBQ", category: "Snacks" }).ok).toBe(true);
  });

  it("refuses an absurdly long name", () => {
    expect(validateNewProduct({ displayName: "x".repeat(200), category: "Snacks" }).ok).toBe(false);
  });
});

describe("building a product from a receipt line", () => {
  const input = {
    displayName: "Lay's Old Fashioned BBQ Chips",
    category: "Snacks",
    subcategory: "Chips",
    rawDescription: "LAYS OLD FSH BBQ",
  };

  it("keeps the raw receipt text as a search alias", () => {
    const product = buildNewCatalogProduct(input);
    expect(product.search_aliases).toContain("lays old fsh bbq");
  });

  // The point of the alias: the same shorthand matches itself next shop.
  it("makes the next receipt find the product by its shorthand", () => {
    const product = buildNewCatalogProduct(input);
    const asCatalog = {
      id: product.id,
      display_name: product.display_name,
      brand: product.brand,
      search_aliases: product.search_aliases,
    } as CatalogProduct;
    expect(searchCatalog([asCatalog], "LAYS OLD FSH BBQ", 5)).toHaveLength(1);
  });

  it("records where it came from, and marks it household-added", () => {
    const product = buildNewCatalogProduct(input);
    expect(product.source).toBe(HOUSEHOLD_PRODUCT_SOURCE);
    expect(product.source_notes).toContain("LAYS OLD FSH BBQ");
    expect(product.manually_edited).toBe(true);
    // No image is asserted for a product we have no photo of.
    expect(product.image_ready).toBe(false);
  });

  it("invents nothing the person didn't supply", () => {
    const product = buildNewCatalogProduct({ displayName: "Rainbow Strips", category: "Confectionery" });
    expect(product.brand).toBeNull();
    expect(product.subcategory).toBeNull();
    expect(product.search_aliases).toEqual([]);
    expect(product.source_notes).toBe("Added by hand");
  });

  it("doesn't store an alias that just repeats the name", () => {
    const product = buildNewCatalogProduct({
      displayName: "Rainbow Strips",
      category: "Confectionery",
      rawDescription: "rainbow strips",
    });
    expect(product.search_aliases).toEqual([]);
  });

  it("avoids colliding with an existing catalogue id", () => {
    const product = buildNewCatalogProduct(input, ["lays-old-fashioned-bbq-chips"]);
    expect(product.id).toBe("lays-old-fashioned-bbq-chips-2");
  });

  it("trims whitespace out of what the person typed", () => {
    const product = buildNewCatalogProduct({
      displayName: "  Rainbow Strips  ",
      category: "Confectionery",
      brand: "  Jyproco  ",
    });
    expect(product.display_name).toBe("Rainbow Strips");
    expect(product.brand).toBe("Jyproco");
  });
});
