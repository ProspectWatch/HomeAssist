import { describe, expect, it } from "vitest";
import { isAllowedSourceType, PRICE_SOURCE_TYPES } from "./source-types";
import { buildFlyerObservations, buildOnlineObservations } from "./flyers/deals";
import type { MatchableCatalogProduct } from "./matching";
import type { KnownRetailer } from "./flyers/merchants";
import type { FlyerDeal, OnlinePrice } from "./flyers/flipp";

const RETAILERS: KnownRetailer[] = [
  { id: "r-fortinos", name: "Fortinos", kind: "STORE" },
  { id: "r-walmart", name: "Walmart", kind: "ONLINE" },
];

const CATALOG_BY_ID = new Map<string, MatchableCatalogProduct>([
  [
    "corn-flakes",
    {
      id: "corn-flakes",
      display_name: "Corn Flakes",
      brand: null,
      category: "Pantry",
      subcategory: "Cereal",
      search_aliases: [],
      default_unit: null,
    },
  ],
]);

const deal: FlyerDeal = {
  merchantName: "Fortinos",
  name: "Kellogg's Corn Flakes 340 G",
  priceCents: 397,
  originalPriceCents: null,
  saleStory: null,
  prePriceText: null,
  postPriceText: null,
  validFrom: null,
  validTo: null,
  flyerId: 1,
  flyerItemId: "a",
  imageUrl: null,
  sourceUrl: null,
};

const online: OnlinePrice = {
  merchantName: "Walmart",
  name: "Kellogg's Corn Flakes 340 G",
  priceCents: 397,
  originalPriceCents: null,
  sku: "1",
  imageUrl: null,
};

describe("price source types", () => {
  it("accepts the adapter:<key> form the database constraint allows", () => {
    expect(isAllowedSourceType("adapter:fortinos")).toBe(true);
    expect(isAllowedSourceType("adapter")).toBe(true);
  });

  it("rejects a source type the database would refuse", () => {
    expect(isAllowedSourceType("WEBSITE")).toBe(false);
    expect(isAllowedSourceType("")).toBe(false);
  });

  // The regression this file exists for: ONLINE shipped in application code
  // while the database constraint still listed only the older sources, so
  // every scan failed at the insert — and because flyer and website rows go
  // in together, the valid flyer deals were discarded with them.
  it("only emits source types the database will accept", () => {
    const flyer = buildFlyerObservations({
      groups: [{ catalogProductId: "corn-flakes", items: [deal] }],
      retailers: RETAILERS,
      catalogById: CATALOG_BY_ID,
      today: "2026-08-31",
      observedAt: "2026-08-31T12:00:00Z",
    });
    const web = buildOnlineObservations({
      groups: [{ catalogProductId: "corn-flakes", items: [online] }],
      retailers: RETAILERS,
      catalogById: CATALOG_BY_ID,
      observedAt: "2026-08-31T12:00:00Z",
    });

    const emitted = [...flyer.observations, ...web.observations].map((o) => o.sourceType);
    expect(emitted.length).toBeGreaterThan(0);
    for (const sourceType of emitted) {
      expect(isAllowedSourceType(sourceType)).toBe(true);
    }
    // Both paths must actually be covered, or this test proves nothing.
    expect(new Set(emitted)).toEqual(new Set(["FLYER", "ONLINE"]));
  });

  it("lists every source type the app writes", () => {
    for (const required of ["RECEIPT", "MANUAL", "FLYER", "ONLINE"]) {
      expect(PRICE_SOURCE_TYPES).toContain(required);
    }
  });
});
