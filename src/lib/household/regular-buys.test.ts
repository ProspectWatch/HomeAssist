import { describe, expect, it } from "vitest";
import {
  BRAND_RIGIDITY_OPTIONS,
  acceptsBrand,
  describeBrandPreference,
  groupRegularBuys,
  isBrandRigidity,
  type RegularBuy,
} from "./regular-buys";

function buy(overrides: Partial<RegularBuy> = {}): RegularBuy {
  return {
    catalogProductId: "potato-chips",
    displayName: "Potato Chips",
    category: "Snacks",
    subcategory: "Chips",
    imageUrl: null,
    imageReady: false,
    preferredBrand: null,
    brandRigidity: "FLEXIBLE",
    isFavourite: false,
    productId: null,
    ...overrides,
  };
}

describe("brand rigidity", () => {
  it("offers exactly the three the database allows", () => {
    expect(BRAND_RIGIDITY_OPTIONS.map((o) => o.value)).toEqual([
      "FLEXIBLE",
      "PREFERRED",
      "EXACT_ONLY",
    ]);
  });

  it.each(["FLEXIBLE", "PREFERRED", "EXACT_ONLY"])("accepts %s", (value) => {
    expect(isBrandRigidity(value)).toBe(true);
  });

  it.each(["", "ANY", "flexible", "STRICT"])("rejects %s", (value) => {
    expect(isBrandRigidity(value)).toBe(false);
  });
});

describe("what a deal has to match", () => {
  // The point of the whole feature: the catalogue concept is generic, so this
  // is what decides whether a branded deal is worth surfacing.
  it("takes any brand when the household is flexible", () => {
    const b = buy({ preferredBrand: "Lay's", brandRigidity: "FLEXIBLE" });
    expect(acceptsBrand(b, "Ruffles")).toBe(true);
    expect(acceptsBrand(b, null)).toBe(true);
  });

  it("still takes another brand when one is merely preferred", () => {
    const b = buy({ preferredBrand: "Lay's", brandRigidity: "PREFERRED" });
    expect(acceptsBrand(b, "Lay's")).toBe(true);
    expect(acceptsBrand(b, "Ruffles")).toBe(true);
  });

  it("takes only the named brand when the household says only", () => {
    const b = buy({ preferredBrand: "Lay's", brandRigidity: "EXACT_ONLY" });
    expect(acceptsBrand(b, "Lay's")).toBe(true);
    expect(acceptsBrand(b, "LAY'S")).toBe(true);
    expect(acceptsBrand(b, " lay's ")).toBe(true);
    expect(acceptsBrand(b, "Ruffles")).toBe(false);
    // An unbranded offer can't be proven to be the right brand.
    expect(acceptsBrand(b, null)).toBe(false);
  });

  it("takes anything when no brand was ever named", () => {
    expect(acceptsBrand(buy({ brandRigidity: "EXACT_ONLY" }), "Ruffles")).toBe(true);
  });
});

describe("how a preference reads", () => {
  it.each([
    ["EXACT_ONLY" as const, "Lay's only"],
    ["PREFERRED" as const, "Lay's preferred"],
    ["FLEXIBLE" as const, "Usually Lay's"],
  ])("describes %s", (brandRigidity, expected) => {
    expect(describeBrandPreference(buy({ preferredBrand: "Lay's", brandRigidity }))).toBe(expected);
  });

  it("says nothing when there is no brand to say", () => {
    expect(describeBrandPreference(buy())).toBeNull();
    expect(describeBrandPreference(buy({ brandRigidity: "EXACT_ONLY" }))).toBeNull();
  });
});

describe("grouping for display", () => {
  it("orders groups by the catalogue's own category order, not alphabetically", () => {
    const groups = groupRegularBuys([
      buy({ catalogProductId: "a", category: "Snacks" }),
      buy({ catalogProductId: "b", category: "Produce" }),
      buy({ catalogProductId: "c", category: "Dairy & Eggs" }),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Produce", "Dairy & Eggs", "Snacks"]);
  });

  it("sorts products within a group by name", () => {
    const groups = groupRegularBuys([
      buy({ catalogProductId: "z", displayName: "Zucchini", category: "Produce" }),
      buy({ catalogProductId: "a", displayName: "Apples", category: "Produce" }),
    ]);
    expect(groups[0].items.map((i) => i.displayName)).toEqual(["Apples", "Zucchini"]);
  });

  it("keeps an unknown category rather than dropping it", () => {
    const groups = groupRegularBuys([
      buy({ catalogProductId: "x", category: "Retired Category" }),
      buy({ catalogProductId: "y", category: "Produce" }),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Produce", "Retired Category"]);
  });

  it("handles an empty baseline", () => {
    expect(groupRegularBuys([])).toEqual([]);
  });
});

describe("groupRegularBuys — favourites", () => {
  it("puts a favourite above its category, not alphabetically", () => {
    // The star is the household saying this one matters; burying "Tostitos"
    // under "Cheetos" because C comes first ignores that.
    const groups = groupRegularBuys([
      buy({ catalogProductId: "a", displayName: "Cheetos", category: "Snacks" }),
      buy({ catalogProductId: "b", displayName: "Tostitos", category: "Snacks", isFavourite: true }),
    ]);
    expect(groups[0].items.map((i) => i.displayName)).toEqual(["Tostitos", "Cheetos"]);
  });

  it("still sorts by name within favourites and within the rest", () => {
    const groups = groupRegularBuys([
      buy({ catalogProductId: "a", displayName: "Ruffles", category: "Snacks" }),
      buy({ catalogProductId: "b", displayName: "Doritos", category: "Snacks", isFavourite: true }),
      buy({ catalogProductId: "c", displayName: "Cheetos", category: "Snacks" }),
      buy({ catalogProductId: "d", displayName: "Alcan", category: "Snacks", isFavourite: true }),
    ]);
    expect(groups[0].items.map((i) => i.displayName)).toEqual([
      "Alcan",
      "Doritos",
      "Cheetos",
      "Ruffles",
    ]);
  });
});
