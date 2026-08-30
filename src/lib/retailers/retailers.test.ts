import { describe, expect, it } from "vitest";
import {
  normalizeName,
  packageSizesComparable,
  parsePackageSize,
  parsePriceToCents,
  parsePromotionWindow,
} from "./normalization";
import { matchToCatalog, type MatchableCatalogProduct } from "./matching";
import { normalizeLoblawProduct } from "./adapters/loblaw-banner";
import { buildProductCandidates, buildScanTargets, scanAllRetailers, scanRetailer } from "./ingestion";
import { classifyFreshness, formatLastChecked, freshnessLabel } from "./freshness";
import { AdapterError, type RetailerAdapter, type RetailerProductRaw, type RetailLocationContext } from "./types";

/* ------------------------------------------------------------------ *
 * TEST FIXTURES ONLY — none of this is household data or a real price.
 * Payload shapes mirror the public Loblaw product facade; the numbers are
 * invented for deterministic testing and must never be treated as observed.
 * ------------------------------------------------------------------ */

const FORTINOS_CONFIG = {
  key: "fortinos",
  retailerName: "Fortinos",
  bannerId: "fortinos",
  siteOrigin: "https://www.fortinos.ca",
};
const NO_FRILLS_CONFIG = {
  key: "no-frills",
  retailerName: "No Frills",
  bannerId: "nofrills",
  siteOrigin: "https://www.nofrills.ca",
};

const CTX = { retailerId: "retailer-1", retailerLocationId: null, observedAt: "2026-08-30T12:00:00.000Z" };

// TEST FIXTURE — shaped like a Loblaw product facade payload, invented values.
const FIXTURE_CHICKEN = {
  code: "20074604001_EA",
  name: "PC Boneless Skinless Chicken Breast",
  brand: "PC",
  packageSize: "1.36 kg",
  link: "/en/pc-boneless-skinless-chicken-breast/p/20074604001_EA",
  prices: {
    price: { value: 18.99, unit: "ea" },
    wasPrice: { value: 22.99, unit: "ea" },
    comparisonPrices: [{ value: 1.4, unit: "100g" }],
  },
  offers: [{ badge: { text: "Save $4.00" }, validFrom: "2026-08-28", validUntil: "2026-09-03" }],
  stockStatus: "IN_STOCK",
  imageAssets: [{ mediumUrl: "https://example.invalid/img.jpg" }],
};

// TEST FIXTURE — a No Frills style payload with no promotion.
const FIXTURE_BANANAS = {
  code: "20000123_EA",
  name: "Bananas",
  brand: null as unknown as string,
  packageSize: "1 ea",
  prices: { price: { value: 0.79, unit: "ea" } },
  stockStatus: "IN_STOCK",
};

// TEST FIXTURE — catalogue rows, mirroring real HomeAssist catalogue shape.
const CATALOG: MatchableCatalogProduct[] = [
  {
    id: "boneless-skinless-chicken-breast",
    display_name: "Boneless Skinless Chicken Breast",
    brand: null,
    category: "Meat & Seafood",
    subcategory: "Poultry",
    search_aliases: ["chicken breast"],
    default_unit: "kg",
  },
  {
    id: "bananas",
    display_name: "Bananas",
    brand: null,
    category: "Produce",
    subcategory: "Fruit",
    search_aliases: ["banana"],
    default_unit: "bunch",
  },
  {
    id: "earth-s-own-original-almond-milk",
    display_name: "Earth's Own Original Almond Milk",
    brand: "Earth's Own",
    category: "Dairy & Eggs",
    subcategory: "Milk",
    search_aliases: ["almond milk"],
    default_unit: "1.89 L",
  },
  {
    id: "green-bell-pepper",
    display_name: "Green Bell Pepper",
    brand: null,
    category: "Produce",
    subcategory: "Vegetables",
    search_aliases: [],
    default_unit: "ea",
  },
  {
    id: "red-bell-pepper",
    display_name: "Red Bell Pepper",
    brand: null,
    category: "Produce",
    subcategory: "Vegetables",
    search_aliases: [],
    default_unit: "ea",
  },
];

describe("normalization", () => {
  it("normalizes names for comparison", () => {
    expect(normalizeName("Earth's Own  ORIGINAL Almond-Milk")).toBe("earths own original almond milk");
  });

  it("parses sale, regular and string prices to cents", () => {
    expect(parsePriceToCents(18.99)).toBe(1899);
    expect(parsePriceToCents("$5.99")).toBe(599);
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents(null)).toBeNull();
  });

  it("parses package sizes including multi-packs", () => {
    expect(parsePackageSize("1.36 kg")).toMatchObject({ quantity: 1.36, unit: "kg" });
    expect(parsePackageSize("4 x 100 mL")).toMatchObject({ quantity: 400, unit: "ml" });
  });

  it("treats equivalent sizes in different units as comparable", () => {
    expect(packageSizesComparable(parsePackageSize("1.36 kg"), parsePackageSize("1360 g"))).toBe(true);
    expect(packageSizesComparable(parsePackageSize("2 L"), parsePackageSize("500 mL"))).toBe(false);
  });

  it("parses promotion dates and refuses to invent a missing one", () => {
    expect(parsePromotionWindow("2026-08-28", "2026-09-03")).toEqual({
      validFrom: "2026-08-28",
      validUntil: "2026-09-03",
    });
    expect(parsePromotionWindow("2026-08-28", null)).toEqual({
      validFrom: "2026-08-28",
      validUntil: null,
    });
  });
});

describe("Fortinos normalization", () => {
  it("maps a promotional product to RetailerProductRaw", () => {
    const raw = normalizeLoblawProduct(FIXTURE_CHICKEN, FORTINOS_CONFIG, CTX)!;
    expect(raw.externalProductId).toBe("20074604001_EA");
    expect(raw.currentPriceCents).toBe(1899);
    expect(raw.regularPriceCents).toBe(2299);
    expect(raw.unitPriceText).toBe("$1.40 / 100g");
    expect(raw.promotionText).toBe("Save $4.00");
    expect(raw.promotionStart).toBe("2026-08-28");
    expect(raw.promotionEnd).toBe("2026-09-03");
    expect(raw.url).toContain("fortinos.ca");
  });

  it("returns null for a payload with no id or name", () => {
    expect(normalizeLoblawProduct({ prices: { price: { value: 1 } } }, FORTINOS_CONFIG, CTX)).toBeNull();
  });
});

describe("No Frills normalization", () => {
  it("maps a non-promotional product and leaves regular price null", () => {
    const raw = normalizeLoblawProduct(FIXTURE_BANANAS, NO_FRILLS_CONFIG, CTX)!;
    expect(raw.currentPriceCents).toBe(79);
    expect(raw.regularPriceCents).toBeNull();
    expect(raw.promotionText).toBeNull();
    expect(raw.url).toContain("nofrills.ca");
  });
});

function rawProduct(overrides: Partial<RetailerProductRaw>): RetailerProductRaw {
  return {
    retailerId: "retailer-1",
    retailerLocationId: null,
    externalProductId: "x",
    url: "https://example.invalid/p/x",
    name: "Something",
    brand: null,
    currentPriceCents: 500,
    observedAt: "2026-08-30T12:00:00.000Z",
    ...overrides,
  };
}

describe("catalogue matching", () => {
  it("matches an exact catalogue name", () => {
    const match = matchToCatalog(rawProduct({ name: "Bananas" }), CATALOG);
    expect(match.status).toBe("MATCHED");
    expect(match.catalogProductId).toBe("bananas");
  });

  it("matches a branded retailer product to the generic catalogue concept", () => {
    const raw = normalizeLoblawProduct(FIXTURE_CHICKEN, FORTINOS_CONFIG, CTX)!;
    const match = matchToCatalog(raw, CATALOG);
    expect(match.catalogProductId).toBe("boneless-skinless-chicken-breast");
    expect(["MATCHED", "LIKELY_MATCH"]).toContain(match.status);
  });

  it("flags an ambiguous product for review instead of guessing", () => {
    // "Bell Pepper" alone cannot choose between the red and green catalogue rows.
    const match = matchToCatalog(rawProduct({ name: "Bell Pepper" }), CATALOG);
    expect(match.catalogProductId).toBeNull();
    expect(match.status).toBe("REVIEW_REQUIRED");
  });

  it("leaves an unrelated product unmatched", () => {
    const match = matchToCatalog(rawProduct({ name: "Motor Oil 5W-30" }), CATALOG);
    expect(match.status).toBe("UNMATCHED");
    expect(match.catalogProductId).toBeNull();
  });

  it("penalises a conflicting brand", () => {
    const wrongBrand = matchToCatalog(
      rawProduct({ name: "Original Almond Milk", brand: "Silk" }),
      CATALOG,
    );
    const rightBrand = matchToCatalog(
      rawProduct({ name: "Original Almond Milk", brand: "Earth's Own" }),
      CATALOG,
    );
    expect(rightBrand.confidence).toBeGreaterThan(wrongBrand.confidence);
  });
});

describe("scan targets", () => {
  const namesById = new Map([
    ["bananas", "Bananas"],
    ["boneless-skinless-chicken-breast", "Boneless Skinless Chicken Breast"],
    ["eggs", "Eggs"],
  ]);

  it("deduplicates and keeps the highest-priority reason", () => {
    const targets = buildScanTargets({
      groceryListCatalogIds: ["eggs"],
      outCatalogIds: ["eggs", "bananas"],
      lowCatalogIds: [],
      regularBuyCatalogIds: ["bananas", "boneless-skinless-chicken-breast"],
      preferenceCatalogIds: [],
      watchCatalogIds: [],
      recipeCatalogIds: [],
      namesById,
    });
    expect(targets).toHaveLength(3);
    expect(targets[0]).toMatchObject({ catalogProductId: "eggs", reason: "GROCERY_LIST" });
    expect(targets[1]).toMatchObject({ catalogProductId: "bananas", reason: "OUT" });
  });

  it("never scans a product it cannot name", () => {
    const targets = buildScanTargets({
      groceryListCatalogIds: ["ghost-product"],
      outCatalogIds: [],
      lowCatalogIds: [],
      regularBuyCatalogIds: [],
      preferenceCatalogIds: [],
      watchCatalogIds: [],
      recipeCatalogIds: [],
      namesById,
    });
    expect(targets).toHaveLength(0);
  });

  it("bounds how much it will ask a retailer for", () => {
    const many = new Map<string, string>();
    const ids: string[] = [];
    for (let i = 0; i < 200; i++) {
      many.set(`p${i}`, `Product ${i}`);
      ids.push(`p${i}`);
    }
    const targets = buildScanTargets(
      {
        groceryListCatalogIds: ids,
        outCatalogIds: [],
        lowCatalogIds: [],
        regularBuyCatalogIds: [],
        preferenceCatalogIds: [],
        watchCatalogIds: [],
        recipeCatalogIds: [],
        namesById: many,
      },
      25,
    );
    expect(targets).toHaveLength(25);
  });
});

const LOCATION: RetailLocationContext = {
  postalCode: "L7R 3A1",
  latitude: null,
  longitude: null,
  radiusKm: null,
  preferredStoreLocationId: null,
  externalRetailerLocationId: null,
};

function fakeAdapter(key: string, behaviour: () => Promise<RetailerProductRaw[]>): RetailerAdapter {
  return {
    key,
    retailerName: key,
    searchProducts: behaviour,
    fetchProduct: async () => null,
  };
}

describe("scanning and failure isolation", () => {
  it("records an observation with full provenance", async () => {
    const raw = normalizeLoblawProduct(FIXTURE_BANANAS, NO_FRILLS_CONFIG, CTX)!;
    const outcome = await scanRetailer(
      fakeAdapter("no-frills", async () => [raw]),
      [{ catalogProductId: "bananas", query: "Bananas", reason: "GROCERY_LIST" }],
      LOCATION,
      CATALOG,
    );
    expect(outcome.status).toBe("COMPLETE");
    if (outcome.status !== "COMPLETE") return;
    expect(outcome.observations).toHaveLength(1);
    const obs = outcome.observations[0];
    expect(obs.catalogProductId).toBe("bananas");
    expect(obs.sourceUrl).toContain("nofrills.ca");
    expect(obs.observedAt).toBe(CTX.observedAt);
    expect(obs.sourceType).toBe("adapter:no-frills");
  });

  it("never records an observation for a product with no price", async () => {
    const priceless = rawProduct({ name: "Bananas", currentPriceCents: null });
    const outcome = await scanRetailer(
      fakeAdapter("no-frills", async () => [priceless]),
      [{ catalogProductId: "bananas", query: "Bananas", reason: "GROCERY_LIST" }],
      LOCATION,
      CATALOG,
    );
    if (outcome.status !== "COMPLETE") throw new Error("expected COMPLETE");
    expect(outcome.observations).toHaveLength(0);
  });

  it("queues ambiguous products for review rather than recording them", async () => {
    const outcome = await scanRetailer(
      fakeAdapter("fortinos", async () => [rawProduct({ name: "Bell Pepper" })]),
      [{ catalogProductId: "green-bell-pepper", query: "Green Bell Pepper", reason: "REGULAR_BUY" }],
      LOCATION,
      CATALOG,
    );
    if (outcome.status !== "COMPLETE") throw new Error("expected COMPLETE");
    expect(outcome.observations).toHaveLength(0);
    expect(outcome.reviewQueue).toHaveLength(1);
  });

  it("reports a blocked retailer as failed instead of as zero prices", async () => {
    const outcome = await scanRetailer(
      fakeAdapter("fortinos", async () => {
        throw new AdapterError("ACCESS_BLOCKED", "Retailer denied automated access.");
      }),
      [{ catalogProductId: "bananas", query: "Bananas", reason: "GROCERY_LIST" }],
      LOCATION,
      CATALOG,
    );
    expect(outcome.status).toBe("FAILED");
    if (outcome.status !== "FAILED") return;
    expect(outcome.reason).toBe("ACCESS_BLOCKED");
  });

  it("keeps a working retailer's results when another fails", async () => {
    const raw = normalizeLoblawProduct(FIXTURE_BANANAS, NO_FRILLS_CONFIG, CTX)!;
    const { outcomes, overall } = await scanAllRetailers(
      [
        fakeAdapter("fortinos", async () => {
          throw new AdapterError("ACCESS_BLOCKED", "blocked");
        }),
        fakeAdapter("no-frills", async () => [raw]),
      ],
      [{ catalogProductId: "bananas", query: "Bananas", reason: "GROCERY_LIST" }],
      LOCATION,
      CATALOG,
    );
    expect(overall).toBe("PARTIAL");
    expect(outcomes.find((o) => o.retailerKey === "fortinos")!.status).toBe("FAILED");
    const noFrills = outcomes.find((o) => o.retailerKey === "no-frills")!;
    expect(noFrills.status).toBe("COMPLETE");
    if (noFrills.status === "COMPLETE") expect(noFrills.observations).toHaveLength(1);
  });

  it("reports FAILED only when every retailer fails", async () => {
    const { overall } = await scanAllRetailers(
      [
        fakeAdapter("fortinos", async () => {
          throw new AdapterError("ACCESS_BLOCKED", "blocked");
        }),
        fakeAdapter("no-frills", async () => {
          throw new AdapterError("ACCESS_BLOCKED", "blocked");
        }),
      ],
      [{ catalogProductId: "bananas", query: "Bananas", reason: "GROCERY_LIST" }],
      LOCATION,
      CATALOG,
    );
    expect(overall).toBe("FAILED");
  });
});

describe("freshness", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");

  it("classifies recent, aging and stale observations", () => {
    expect(classifyFreshness("2026-08-30T10:00:00.000Z", now)).toBe("FRESH");
    expect(classifyFreshness("2026-08-28T10:00:00.000Z", now)).toBe("AGING");
    expect(classifyFreshness("2026-08-01T10:00:00.000Z", now)).toBe("STALE");
  });

  it("qualifies anything that is not fresh", () => {
    expect(freshnessLabel("FRESH")).toBeNull();
    expect(freshnessLabel("AGING")).toBeTruthy();
    expect(freshnessLabel("STALE")).toBeTruthy();
  });

  it("formats a human last-checked stamp", () => {
    expect(formatLastChecked("2026-08-30T16:12:00.000Z", now)).toMatch(/^Today /);
    expect(formatLastChecked("2026-08-29T16:12:00.000Z", now)).toMatch(/^Yesterday /);
  });
});

describe("candidate generation", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");

  it("converts observations into the existing ProductCandidate contract", async () => {
    const raw = normalizeLoblawProduct(FIXTURE_CHICKEN, FORTINOS_CONFIG, CTX)!;
    const outcome = await scanRetailer(
      fakeAdapter("fortinos", async () => [raw]),
      [{ catalogProductId: "boneless-skinless-chicken-breast", query: "Chicken Breast", reason: "GROCERY_LIST" }],
      LOCATION,
      CATALOG,
    );
    if (outcome.status !== "COMPLETE") throw new Error("expected COMPLETE");

    const candidates = buildProductCandidates(outcome.observations, { now });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      catalogueProductId: "boneless-skinless-chicken-breast",
      retailerProductId: "20074604001_EA",
      priceCents: 1899,
      unitPriceCents: 140,
      // The retailer layer must not pre-judge household fit (§6).
      matchQuality: "ACCEPTABLE",
    });
  });

  it("excludes stale observations from the engine's inputs", async () => {
    const raw = normalizeLoblawProduct(FIXTURE_BANANAS, NO_FRILLS_CONFIG, {
      ...CTX,
      observedAt: "2026-07-01T12:00:00.000Z",
    })!;
    const outcome = await scanRetailer(
      fakeAdapter("no-frills", async () => [raw]),
      [{ catalogProductId: "bananas", query: "Bananas", reason: "GROCERY_LIST" }],
      LOCATION,
      CATALOG,
    );
    if (outcome.status !== "COMPLETE") throw new Error("expected COMPLETE");
    expect(outcome.observations).toHaveLength(1);
    expect(buildProductCandidates(outcome.observations, { now })).toHaveLength(0);
  });

  it("excludes observations that never matched the catalogue", () => {
    const candidates = buildProductCandidates(
      [
        {
          catalogProductId: null,
          retailerId: "retailer-1",
          retailerLocationId: null,
          externalProductId: "x",
          observedPriceCents: 599,
          regularPriceCents: null,
          unitPriceText: null,
          packageSize: null,
          unit: null,
          promotionText: null,
          validFrom: null,
          validUntil: null,
          availability: null,
          sourceUrl: null,
          sourceType: "adapter:test",
          matchConfidence: 0.2,
          matchMethod: "token_overlap",
          matchStatus: "UNMATCHED",
          rawName: "Mystery item",
          rawBrand: null,
          observedAt: now.toISOString(),
        },
      ],
      { now },
    );
    expect(candidates).toHaveLength(0);
  });
});
