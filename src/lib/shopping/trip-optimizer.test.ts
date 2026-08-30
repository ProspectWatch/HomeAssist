import { describe, expect, it } from "vitest";
import { buildShoppingPlan, type RetailerMeta } from "./trip-optimizer";
import { classifyDeal } from "./deal-quality";
import { matchCandidate } from "./product-matching";
import type { ProductCandidate, ProductNeed } from "./types";

// ---------------------------------------------------------------------------
// TEST FIXTURES — none of this represents real household or retailer data;
// it exists only to exercise the decision engine. Real recommendations come
// from real ProductNeed/ProductCandidate/PriceObservation data supplied by
// the caller (see lib/data/*.ts), never from anything defined here.
// ---------------------------------------------------------------------------

const FORTINOS: RetailerMeta = { id: "fortinos", name: "Fortinos" };
const FOOD_BASICS: RetailerMeta = { id: "food-basics", name: "Food Basics" };
const MARILUS: RetailerMeta = { id: "marilus", name: "Marilu's Market" };
const RETAILERS = [FORTINOS, FOOD_BASICS, MARILUS];

function need(overrides: Partial<ProductNeed> = {}): ProductNeed {
  return {
    catalogueProductId: "test-product",
    name: "Test Product",
    quantity: null,
    preference: null,
    urgency: "routine",
    targetPriceCents: null,
    ...overrides,
  };
}

function candidate(overrides: Partial<ProductCandidate>): ProductCandidate {
  return {
    catalogueProductId: "test-product",
    retailerId: FORTINOS.id,
    retailerProductId: null,
    retailerProductName: "Test Product",
    brand: null,
    variant: null,
    packageSize: null,
    quantity: 1,
    priceCents: 500,
    unitPriceCents: null,
    matchQuality: "EXACT",
    ...overrides,
  };
}

describe("buildShoppingPlan — same-price store convenience", () => {
  it("FIXTURE: milk is $5.99 at both Fortinos and Food Basics; Fortinos is already planned", () => {
    const milkNeed = need({ catalogueProductId: "milk", name: "Milk" });
    const result = buildShoppingPlan({
      items: [
        {
          need: milkNeed,
          candidates: [
            candidate({ catalogueProductId: "milk", retailerId: FORTINOS.id, priceCents: 599 }),
            candidate({ catalogueProductId: "milk", retailerId: FOOD_BASICS.id, priceCents: 599 }),
          ],
        },
      ],
      retailers: RETAILERS,
      existingPlannedStops: [{ retailerId: FORTINOS.id, reason: "planned", distanceKm: null, driveTimeMinutes: null }],
    });

    const rec = result.recommendations[0];
    expect(rec.recommendedRetailerId).toBe(FORTINOS.id);
    expect(rec.tripImpact.requiresNewStop).toBe(false);
    expect(rec.reason).toMatch(/already going to Fortinos/i);
  });
});

describe("buildShoppingPlan — small savings not worth a separate trip", () => {
  it("FIXTURE: milk is $0.50 cheaper at Food Basics, a store not already planned", () => {
    const milkNeed = need({ catalogueProductId: "milk", name: "Milk" });
    const result = buildShoppingPlan({
      items: [
        {
          need: milkNeed,
          candidates: [
            candidate({ catalogueProductId: "milk", retailerId: FORTINOS.id, priceCents: 599 }),
            candidate({ catalogueProductId: "milk", retailerId: FOOD_BASICS.id, priceCents: 549 }),
          ],
        },
      ],
      retailers: RETAILERS,
      existingPlannedStops: [{ retailerId: FORTINOS.id, reason: "planned", distanceKm: null, driveTimeMinutes: null }],
    });

    const rec = result.recommendations[0];
    expect(rec.recommendedRetailerId).toBe(FORTINOS.id);
    expect(rec.tripImpact.requiresNewStop).toBe(false);
    expect(rec.reason).toMatch(/not enough to justify a separate trip/i);
    expect(result.avoidedStops.some((s) => s.retailerId === FOOD_BASICS.id)).toBe(true);
  });
});

describe("buildShoppingPlan — large aggregate savings worth an extra stop", () => {
  it("FIXTURE: Food Basics saves $11 total across 6 required products", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      need: need({ catalogueProductId: `item-${i}`, name: `Item ${i}` }),
      candidates: [
        candidate({ catalogueProductId: `item-${i}`, retailerId: FORTINOS.id, priceCents: 1000 }),
        // ~$1.83 cheaper each * 6 = ~$11
        candidate({ catalogueProductId: `item-${i}`, retailerId: FOOD_BASICS.id, priceCents: 817 }),
      ],
    }));

    const result = buildShoppingPlan({
      items,
      retailers: RETAILERS,
      existingPlannedStops: [{ retailerId: FORTINOS.id, reason: "planned", distanceKm: null, driveTimeMinutes: null }],
    });

    expect(result.recommendations.every((r) => r.recommendedRetailerId === FOOD_BASICS.id)).toBe(true);
    expect(result.recommendations[0].tripImpact.requiresNewStop).toBe(true);
    expect(result.recommendations[0].reason).toMatch(/saves \$1[01]\.\d\d across everything/i);
    expect(result.estimatedSavingsCents).toBeGreaterThanOrEqual(1000); // ~$11 aggregate
  });
});

describe("buildShoppingPlan — preferred retailer tie-break", () => {
  it("FIXTURE: produce is preferred at Marilu's, and the price gap is only $0.30", () => {
    const produceNeed = need({
      catalogueProductId: "tomatoes",
      name: "Tomatoes",
      preference: {
        preferredBrand: null,
        preferredVariant: null,
        preferredSize: null,
        preferredStoreId: MARILUS.id,
        acceptableBrands: [],
        acceptableStores: [],
        brandRigidity: "FLEXIBLE",
      },
    });
    const result = buildShoppingPlan({
      items: [
        {
          need: produceNeed,
          candidates: [
            candidate({ catalogueProductId: "tomatoes", retailerId: FOOD_BASICS.id, priceCents: 299 }),
            candidate({ catalogueProductId: "tomatoes", retailerId: MARILUS.id, priceCents: 329 }),
          ],
        },
      ],
      retailers: RETAILERS,
    });

    const rec = result.recommendations[0];
    expect(rec.recommendedRetailerId).toBe(MARILUS.id);
    expect(rec.reason).toMatch(/preferred for this item/i);
  });

  it("does NOT tie-break to the preferred store when the gap is large", () => {
    const produceNeed = need({
      catalogueProductId: "tomatoes",
      name: "Tomatoes",
      preference: {
        preferredBrand: null,
        preferredVariant: null,
        preferredSize: null,
        preferredStoreId: MARILUS.id,
        acceptableBrands: [],
        acceptableStores: [],
        brandRigidity: "FLEXIBLE",
      },
    });
    const result = buildShoppingPlan({
      items: [
        {
          need: produceNeed,
          candidates: [
            candidate({ catalogueProductId: "tomatoes", retailerId: FOOD_BASICS.id, priceCents: 199 }),
            candidate({ catalogueProductId: "tomatoes", retailerId: MARILUS.id, priceCents: 399 }),
          ],
        },
      ],
      retailers: RETAILERS,
    });

    expect(result.recommendations[0].recommendedRetailerId).toBe(FOOD_BASICS.id);
  });
});

describe("matchCandidate — exact brand preference (EXACT_ONLY)", () => {
  it("FIXTURE: household requires Conestoga eggs specifically", () => {
    const eggNeed = need({
      catalogueProductId: "eggs",
      name: "Eggs",
      preference: {
        preferredBrand: "Conestoga",
        preferredVariant: "Brown, Free-Range",
        preferredSize: null,
        preferredStoreId: null,
        acceptableBrands: [],
        acceptableStores: [],
        brandRigidity: "EXACT_ONLY",
      },
    });

    const exact = matchCandidate(
      eggNeed,
      candidate({ catalogueProductId: "eggs", brand: "Conestoga", variant: "Brown, Free-Range" }),
    );
    expect(exact.matchQuality).toBe("EXACT");

    const wrongBrand = matchCandidate(
      eggNeed,
      candidate({ catalogueProductId: "eggs", brand: "Neilson", variant: "Brown, Free-Range" }),
    );
    expect(wrongBrand.matchQuality).toBe("LAST_RESORT");
  });
});

describe("matchCandidate — flexible brand preference", () => {
  it("FIXTURE: milk is acceptable from Lactantia or Neilson, brand_rigidity FLEXIBLE", () => {
    const milkNeed = need({
      catalogueProductId: "milk",
      name: "Milk",
      preference: {
        preferredBrand: null,
        preferredVariant: "2% or Lactose-Free",
        preferredSize: null,
        preferredStoreId: null,
        acceptableBrands: ["Lactantia", "Neilson"],
        acceptableStores: [],
        brandRigidity: "FLEXIBLE",
      },
    });

    const acceptable = matchCandidate(milkNeed, candidate({ catalogueProductId: "milk", brand: "Neilson" }));
    expect(acceptable.matchQuality).toBe("VERY_CLOSE");

    const other = matchCandidate(milkNeed, candidate({ catalogueProductId: "milk", brand: "Beatrice" }));
    expect(other.matchQuality).toBe("ACCEPTABLE"); // flexible: never excluded outright
  });
});

describe("matchCandidate — generic produce preference (category-level, no brand)", () => {
  it("FIXTURE: Produce category prefers Marilu's Market, with no brand at all", () => {
    const produceNeed = need({
      catalogueProductId: "lettuce",
      name: "Lettuce",
      preference: {
        preferredBrand: null,
        preferredVariant: null,
        preferredSize: null,
        preferredStoreId: MARILUS.id,
        acceptableBrands: [],
        acceptableStores: [],
        brandRigidity: "FLEXIBLE",
      },
    });
    const match = matchCandidate(produceNeed, candidate({ catalogueProductId: "lettuce", retailerId: MARILUS.id }));
    // No brand to violate — a produce item with only a store preference
    // should never be excluded for "wrong brand".
    expect(["EXACT", "VERY_CLOSE", "ACCEPTABLE"]).toContain(match.matchQuality);
    expect(match.matchQuality).not.toBe("LAST_RESORT");
  });
});

describe("classifyDeal — target price hit", () => {
  it("FIXTURE: watch item's target price is $3.00, current price is $2.79 (not a new low — $2.60 was seen before)", () => {
    const result = classifyDeal({
      currentPriceCents: 279,
      regularPriceCents: 349,
      historicalPriceCents: [349, 329, 260],
      targetPriceCents: 300,
    });
    expect(result.targetPriceHit).toBe(true);
    expect(result.quality).toBe("TARGET_HIT");
    expect(result.hasSufficientData).toBe(true);
  });
});

describe("classifyDeal — insufficient-data result", () => {
  it("FIXTURE: a product with no regular price, no history, and no target set", () => {
    const result = classifyDeal({
      currentPriceCents: 450,
      regularPriceCents: null,
      historicalPriceCents: [],
      targetPriceCents: null,
    });
    expect(result.quality).toBeNull();
    expect(result.hasSufficientData).toBe(false);
    expect(result.reason).toMatch(/not enough price history/i);
  });
});

describe("buildShoppingPlan — insufficient-data result", () => {
  it("FIXTURE: a real grocery list, but zero price observations anywhere", () => {
    const result = buildShoppingPlan({
      items: [
        { need: need({ catalogueProductId: "milk", name: "Milk" }), candidates: [] },
        { need: need({ catalogueProductId: "bread", name: "Bread" }), candidates: [] },
      ],
      retailers: RETAILERS,
    });
    expect(result.status).toBe("insufficient_data");
    expect(result.summary).toMatch(/add current store prices/i);
    expect(result.recommendations.every((r) => r.recommendedCandidate === null)).toBe(true);
    expect(result.recommendations.every((r) => r.confidence === 0)).toBe(true);
  });

  it("an empty shopping list reports status empty, not insufficient_data", () => {
    const result = buildShoppingPlan({ items: [], retailers: RETAILERS });
    expect(result.status).toBe("empty");
    expect(result.trips).toEqual([]);
  });
});

describe("classifyDeal — all-time low", () => {
  it("FIXTURE: current price beats every prior observation and the regular price", () => {
    const result = classifyDeal({
      currentPriceCents: 279,
      regularPriceCents: 349,
      historicalPriceCents: [349, 329, 299, 289],
      targetPriceCents: null,
    });
    expect(result.isAllTimeLow).toBe(true);
    expect(result.quality).toBe("ALL_TIME_LOW");
  });
});
