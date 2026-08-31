import { describe, expect, it } from "vitest";
import {
  buildBrandVariants,
  variantLabel,
  variantsForListItem,
  type HouseholdProductRow,
} from "./variants";

const products: HouseholdProductRow[] = [
  { brand: "Doritos", title: "Doritos Nacho Cheese Tortilla Chips", catalogProductId: "d1" },
  { brand: "Doritos", title: "Doritos Ketchup", catalogProductId: "d2" },
  { brand: "Doritos", title: "Doritos Sweet Chili Heat", catalogProductId: "d3" },
  { brand: "Heinz", title: "Heinz Tomato Ketchup", catalogProductId: "h1" },
  { brand: "Kraft", title: "Kraft Smooth Peanut Butter", catalogProductId: "k1" },
  { brand: "Kraft", title: "Kraft Crunchy Peanut Butter", catalogProductId: "k2" },
  { brand: "Kraft Singles", title: "Kraft Singles Original Cheddar", catalogProductId: "ks1" },
  { brand: "Kraft Singles", title: "Kraft Singles Herb & Garlic", catalogProductId: "ks2" },
  { brand: null, title: "Almond Milk", catalogProductId: "a1" },
];

describe("variantLabel", () => {
  it("strips the brand from the front", () => {
    expect(variantLabel("Doritos", "Doritos Sweet Chili Heat")).toBe("Sweet Chili Heat");
  });

  it("is case-insensitive about the brand", () => {
    expect(variantLabel("doritos", "Doritos Ketchup")).toBe("Ketchup");
  });

  it("returns null when the title is only the brand", () => {
    expect(variantLabel("Oreo", "Oreo")).toBeNull();
  });

  it("trims the separator left behind", () => {
    expect(variantLabel("Lay's", "Lay's — Salt & Vinegar")).toBe("Salt & Vinegar");
  });

  it("keeps the whole title when the brand is not in it", () => {
    expect(variantLabel("Ruffles", "All Dressed Chips")).toBe("All Dressed Chips");
  });

  it("handles a brand at the end", () => {
    expect(variantLabel("Gelato", "Mediterranean Mint Gelato")).toBe("Mediterranean Mint");
  });
});

describe("buildBrandVariants", () => {
  const brands = buildBrandVariants(products);

  it("offers a choice only where there is more than one flavour", () => {
    expect(brands.map((b) => b.brand).sort()).toEqual(["Doritos", "Kraft", "Kraft Singles"]);
  });

  it("lists the household's own flavours, sorted", () => {
    const doritos = brands.find((b) => b.brand === "Doritos")!;
    expect(doritos.variants).toEqual(["Ketchup", "Nacho Cheese Tortilla Chips", "Sweet Chili Heat"]);
  });

  it("ignores products with no brand", () => {
    expect(brands.some((b) => b.brand === "")).toBe(false);
  });

  it("collects every catalogue id under the brand", () => {
    const doritos = brands.find((b) => b.brand === "Doritos")!;
    expect(doritos.catalogProductIds.sort()).toEqual(["d1", "d2", "d3"]);
  });
});

describe("variantsForListItem", () => {
  const brands = buildBrandVariants(products);

  it("matches on catalogue id first", () => {
    const match = variantsForListItem({ name: "Tortilla chips", catalogProductId: "d2" }, brands);
    expect(match?.brand).toBe("Doritos");
  });

  it("falls back to the brand named in the line", () => {
    expect(variantsForListItem({ name: "Doritos", catalogProductId: null }, brands)?.brand).toBe(
      "Doritos",
    );
  });

  it("offers nothing for a brand with one flavour", () => {
    expect(variantsForListItem({ name: "Heinz Ketchup", catalogProductId: "h1" }, brands)).toBeNull();
  });

  it("offers nothing when no brand is recognised", () => {
    expect(variantsForListItem({ name: "Bananas", catalogProductId: null }, brands)).toBeNull();
  });

  it("prefers the longer brand when both appear", () => {
    expect(
      variantsForListItem({ name: "Kraft Singles", catalogProductId: null }, brands)?.brand,
    ).toBe("Kraft Singles");
  });

  it("does not match a brand inside a longer word", () => {
    expect(variantsForListItem({ name: "Kraftwerk tickets", catalogProductId: null }, brands)).toBeNull();
  });
});
