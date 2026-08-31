import { describe, expect, it } from "vitest";
import { groupDeals } from "./flyer-deals";
import type { LiveDeal } from "./flyer-deals";

function offer(overrides: Partial<LiveDeal> & { id: string; priceCents: number }): LiveDeal {
  return {
    catalogProductId: "watermelon",
    name: "Watermelon",
    category: "Produce",
    imageUrl: null,
    imageReady: false,
    retailerName: "Food Basics",
    regularPriceCents: null,
    promotionText: null,
    rawName: "SEEDLESS WATERMELON",
    validUntil: "2026-09-03",
    sourceUrl: null,
    isRegularBuy: true,
    matchStatus: "LIKELY_MATCH",
    offerImageUrl: null,
    isMultiItemOffer: false,
    verdict: null,
    ...overrides,
  };
}

describe("groupDeals", () => {
  it("puts every store for one product on a single entry, cheapest first", () => {
    // The screen this fixes: the same watermelon rendered as three separate
    // cards, leaving the reader to notice one was a quarter of the price.
    const groups = groupDeals([
      offer({ id: "a", priceCents: 488, retailerName: "Food Basics" }),
      offer({ id: "b", priceCents: 129, retailerName: "Fortinos" }),
      offer({ id: "c", priceCents: 649, retailerName: "No Frills" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].offers.map((o) => o.retailerName)).toEqual(["Fortinos", "Food Basics", "No Frills"]);
    expect(groups[0].bestPriceCents).toBe(129);
    expect(groups[0].spreadCents).toBe(520);
  });

  it("keeps different products apart", () => {
    const groups = groupDeals([
      offer({ id: "a", priceCents: 488 }),
      offer({ id: "b", priceCents: 198, catalogProductId: "green-grapes", name: "Green Grapes" }),
    ]);
    expect(groups.map((g) => g.name).sort()).toEqual(["Green Grapes", "Watermelon"]);
  });

  it("reports no spread when only one store is offering it", () => {
    const groups = groupDeals([offer({ id: "a", priceCents: 488 })]);
    expect(groups[0].spreadCents).toBe(0);
    expect(groups[0].offers).toHaveLength(1);
  });

  it("leads with products where the store you pick actually matters", () => {
    const groups = groupDeals([
      offer({ id: "a", priceCents: 488, catalogProductId: "solo", name: "Solo Item" }),
      offer({ id: "b", priceCents: 488, catalogProductId: "cheap", name: "Big Gap", retailerName: "Fortinos" }),
      offer({ id: "c", priceCents: 129, catalogProductId: "cheap", name: "Big Gap", retailerName: "Food Basics" }),
    ]);
    expect(groups[0].name).toBe("Big Gap");
  });

  it("falls back to the flyer's own picture when the catalogue has none", () => {
    const groups = groupDeals([
      offer({ id: "a", priceCents: 488, offerImageUrl: "https://img.example/melon.jpg" }),
    ]);
    expect(groups[0].imageUrl).toBe("https://img.example/melon.jpg");
    expect(groups[0].imageReady).toBe(true);
  });

  it("prefers the catalogue's own photograph over a flyer clipping", () => {
    const groups = groupDeals([
      offer({
        id: "a",
        priceCents: 488,
        imageUrl: "https://img.example/catalogue.jpg",
        imageReady: true,
        offerImageUrl: "https://img.example/flyer.jpg",
      }),
    ]);
    expect(groups[0].imageUrl).toBe("https://img.example/catalogue.jpg");
  });
});
