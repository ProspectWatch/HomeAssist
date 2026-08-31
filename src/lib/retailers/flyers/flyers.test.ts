import { describe, expect, it } from "vitest";
import {
  isCurrentlyValid,
  countSizeMentions,
  isMultiItemOffer,
  offerKey,
  parseFlippItems,
  promotionText,
  toCents,
  type FlyerDeal,
} from "./flipp";
import { buildMerchantIndex, normalizeMerchant, resolveMerchant } from "./merchants";
import { buildFlyerObservations } from "./deals";
import type { MatchableCatalogProduct } from "../matching";

const RETAILERS = [
  { id: "r-fortinos", name: "Fortinos" },
  { id: "r-nofrills", name: "No Frills" },
  { id: "r-foodbasics", name: "Food Basics" },
  { id: "r-marilus", name: "Marilu's Market" },
];

const CATALOG: MatchableCatalogProduct[] = [
  {
    id: "chicken-breast",
    display_name: "Chicken Breast",
    brand: null,
    category: "Meat & Seafood",
    subcategory: "Chicken",
    search_aliases: ["chicken breasts"],
    default_unit: "kg",
  },
  {
    id: "cheddar-cheese-block",
    display_name: "Cheddar Cheese Block",
    brand: null,
    category: "Dairy & Eggs",
    subcategory: "Cheese",
    search_aliases: [],
    default_unit: "g",
  },
];

function flippPayload(items: unknown[]) {
  return { items, ecom_items: [{ name: "Ignore me", merchant: "Walmart", current_price: 1.99 }] };
}

function deal(overrides: Partial<FlyerDeal> = {}): FlyerDeal {
  return {
    merchantName: "Fortinos",
    name: "Chicken Breast",
    priceCents: 399,
    originalPriceCents: null,
    saleStory: null,
    prePriceText: null,
    postPriceText: null,
    validFrom: "2026-08-27",
    validTo: "2026-09-02",
    flyerId: 1,
    flyerItemId: "abc",
    imageUrl: null,
    sourceUrl: "https://flipp.com/en-ca/flyer/1",
    ...overrides,
  };
}

describe("toCents", () => {
  it("reads decimal dollars, as strings or numbers", () => {
    expect(toCents(4.94)).toBe(494);
    expect(toCents("7.88")).toBe(788);
    expect(toCents(10)).toBe(1000);
  });

  it("rejects anything that isn't a real price", () => {
    for (const value of [null, undefined, 0, -1, "", "free", NaN]) {
      expect(toCents(value)).toBeNull();
    }
  });
});

describe("parseFlippItems", () => {
  it("reads flyer items with their merchant, price and validity window", () => {
    const deals = parseFlippItems(
      flippPayload([
        {
          name: "FRESH CHICKEN BREAST",
          merchant_name: "Fortinos",
          current_price: 3.99,
          original_price: 5.49,
          sale_story: "SAVE $1.50",
          pre_price_text: "ON SALE FOR",
          post_price_text: "/lb",
          valid_from: "2026-08-27T04:00:00+00:00",
          valid_to: "2026-09-02T03:59:59+00:00",
          flyer_id: 8105715,
          flyer_item_id: "item-1",
          clean_image_url: "https://img.example/1.png",
        },
      ]),
    );

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      merchantName: "Fortinos",
      name: "FRESH CHICKEN BREAST",
      priceCents: 399,
      originalPriceCents: 549,
      validFrom: "2026-08-27",
      validTo: "2026-09-02",
      sourceUrl: "https://flipp.com/en-ca/flyer/8105715",
    });
  });

  it("ignores ecom listings, which are not local flyer deals", () => {
    expect(parseFlippItems(flippPayload([]))).toEqual([]);
  });

  it("drops items with no readable price, merchant or name", () => {
    const deals = parseFlippItems(
      flippPayload([
        { name: "No price", merchant_name: "Fortinos" },
        { name: "No merchant", current_price: 1.99 },
        { merchant_name: "Fortinos", current_price: 1.99 },
        { name: "Fine", merchant_name: "Fortinos", current_price: 1.99 },
      ]),
    );
    expect(deals.map((d) => d.name)).toEqual(["Fine"]);
  });

  it("survives a payload that isn't the shape we expect", () => {
    expect(parseFlippItems(null)).toEqual([]);
    expect(parseFlippItems({})).toEqual([]);
    expect(parseFlippItems({ items: "nope" })).toEqual([]);
  });
});

describe("isCurrentlyValid", () => {
  it("excludes flyers that have ended or haven't started", () => {
    expect(isCurrentlyValid(deal(), "2026-08-30")).toBe(true);
    expect(isCurrentlyValid(deal(), "2026-09-02")).toBe(true);
    expect(isCurrentlyValid(deal(), "2026-09-03")).toBe(false);
    expect(isCurrentlyValid(deal(), "2026-08-26")).toBe(false);
  });

  it("keeps a deal whose flyer printed no dates", () => {
    expect(isCurrentlyValid(deal({ validFrom: null, validTo: null }), "2026-08-30")).toBe(true);
  });
});

describe("promotionText", () => {
  it("uses the flyer's own wording and nothing else", () => {
    expect(promotionText(deal({ prePriceText: "ON SALE FOR", saleStory: "SAVE $1.50", postPriceText: "/lb" }))).toBe(
      "ON SALE FOR · SAVE $1.50 · /lb",
    );
  });

  it("is null when the flyer said nothing beyond the price", () => {
    expect(promotionText(deal())).toBeNull();
  });
});

describe("normalizeMerchant / resolveMerchant", () => {
  const index = buildMerchantIndex(RETAILERS);

  it("matches the household's stores regardless of punctuation and case", () => {
    expect(resolveMerchant(index, "FORTINOS")?.id).toBe("r-fortinos");
    expect(resolveMerchant(index, "no frills")?.id).toBe("r-nofrills");
    expect(resolveMerchant(index, "Marilu’s Market")?.id).toBe("r-marilus");
  });

  it("does not conflate different stores", () => {
    expect(normalizeMerchant("Fortinos")).not.toBe(normalizeMerchant("Food Basics"));
    expect(resolveMerchant(index, "Real Canadian Superstore")).toBeNull();
    expect(resolveMerchant(index, "Metro")).toBeNull();
  });
});

describe("buildFlyerObservations", () => {
  const base = { retailers: RETAILERS, catalog: CATALOG, today: "2026-08-30", observedAt: "2026-08-30T12:00:00Z" };

  it("keeps only deals at the household's own stores", () => {
    const result = buildFlyerObservations({
      ...base,
      deals: [deal(), deal({ merchantName: "Metro" }), deal({ merchantName: "Sobeys" })],
    });

    expect(result.seen).toBe(3);
    expect(result.observations).toHaveLength(1);
    expect(result.skippedUnknownMerchant).toBe(2);
    expect(result.observations[0].retailerId).toBe("r-fortinos");
  });

  it("drops expired flyers and counts them", () => {
    const result = buildFlyerObservations({ ...base, deals: [deal({ validTo: "2026-08-01" })] });
    expect(result.observations).toHaveLength(0);
    expect(result.skippedExpired).toBe(1);
  });

  it("refuses to store a deal it cannot confidently identify", () => {
    const result = buildFlyerObservations({
      ...base,
      deals: [deal({ name: "ASSORTED PANTRY ITEMS" })],
    });
    expect(result.observations).toHaveLength(0);
    expect(result.skippedUnmatched).toBe(1);
  });

  it("marks every stored row as a flyer price with its window and provenance", () => {
    const result = buildFlyerObservations({
      ...base,
      deals: [deal({ saleStory: "SAVE $1.50", originalPriceCents: 549 })],
    });

    const observation = result.observations[0];
    expect(observation.sourceType).toBe("FLYER");
    expect(observation.observedPriceCents).toBe(399);
    expect(observation.regularPriceCents).toBe(549);
    expect(observation.validUntil).toBe("2026-09-02");
    expect(observation.promotionText).toBe("SAVE $1.50");
    expect(observation.sourceUrl).toBe("https://flipp.com/en-ca/flyer/1");
    expect(observation.rawName).toBe("Chicken Breast");
    expect(["MATCHED", "LIKELY_MATCH"]).toContain(observation.matchStatus);
  });

  it("reports the full picture, not just what it kept", () => {
    const result = buildFlyerObservations({
      ...base,
      deals: [deal(), deal({ merchantName: "Metro" }), deal({ validTo: "2026-01-01" }), deal({ name: "MYSTERY BOX" })],
    });

    expect(result.seen).toBe(4);
    expect(
      result.observations.length +
        result.skippedUnknownMerchant +
        result.skippedExpired +
        result.skippedUnmatched,
    ).toBe(result.seen);
  });
});

describe("isMultiItemOffer", () => {
  it("spots the flyer offers that cover more than one product", () => {
    // All real flyer text from a live scan.
    expect(isMultiItemOffer("IÖGO YOGURT OR SIGGI'S SKYR YOGURT")).toBe(true);
    expect(isMultiItemOffer("FARMER'S MARKET TM CARROTS, 2 LB OR PC® COLESLAW, 397 G")).toBe(true);
    expect(isMultiItemOffer("STRAWBERRIES, 1 LB CLAMSHELL, BLUEBERRIES OR BLACKBERRIES, 6 OZ CLAMSHELL")).toBe(true);
  });

  it("leaves single-product offers alone", () => {
    expect(isMultiItemOffer("SCHNEIDERS® BACON, 375G")).toBe(false);
    expect(isMultiItemOffer("MEDIUM GROUND BEEF FAMILY PACK")).toBe(false);
    expect(isMultiItemOffer("ASTRO BALKAN YOGURT")).toBe(false);
    expect(isMultiItemOffer(null)).toBe(false);
  });

  it("does not fire on 'or' inside a word", () => {
    expect(isMultiItemOffer("ORANGE JUICE")).toBe(false);
    expect(isMultiItemOffer("PORK LOIN")).toBe(false);
    expect(isMultiItemOffer("ORGANIC CARROTS")).toBe(false);
  });

  it("catches multi-product offers that never say 'or'", () => {
    // Real flyer text: one Food Basics offer spanning two yogurt brands.
    expect(isMultiItemOffer("IÖGO YOGURT 16 X 100 G SIGGI'S SKYR YOGURT 650 - 750 G")).toBe(true);
    expect(
      isMultiItemOffer("IÖGO NANO DRINKABLE YOGURT 6 X 355 ML GRAB & GO YOGURT 4 X 100 G BUBBLES YOGURT 4 X 100 G"),
    ).toBe(true);
  });

  it("does not mistake one product's size range or multipack for two products", () => {
    // All real single-product flyer entries.
    expect(isMultiItemOffer("SCHNEIDERS® BACON, 375G")).toBe(false);
    expect(isMultiItemOffer("GENERAL MILLS JUMBO CEREAL, 825 G-1.3 KG")).toBe(false);
    expect(isMultiItemOffer("KASHI CEREAL, 349-510 G")).toBe(false);
    expect(isMultiItemOffer("Natrel Chocolate Milk 200 mL, 16-count")).toBe(false);
    expect(isMultiItemOffer("Kirkland Signature Crumbled Bacon, 567 g")).toBe(false);
    expect(isMultiItemOffer("SIGGI'S SKYR YOGURT, 4X100 G")).toBe(false);
  });
});

describe("countSizeMentions", () => {
  it("counts a range or a multipack as the one size it describes", () => {
    expect(countSizeMentions("GENERAL MILLS JUMBO CEREAL, 825 G-1.3 KG")).toBe(1);
    expect(countSizeMentions("KASHI CEREAL, 349-510 G")).toBe(1);
    expect(countSizeMentions("SIGGI'S SKYR YOGURT, 4X100 G")).toBe(1);
    expect(countSizeMentions("SCHNEIDERS® BACON, 375G")).toBe(1);
  });

  it("counts each product's size separately in a combined offer", () => {
    expect(countSizeMentions("IÖGO YOGURT 16 X 100 G SIGGI'S SKYR YOGURT 650 - 750 G")).toBe(2);
  });

  it("is zero when the flyer states no size", () => {
    expect(countSizeMentions("SELECTION BACON")).toBe(0);
  });
});

describe("offerKey", () => {
  it("treats cosmetic differences in the same ad as one offer", () => {
    // Both of these came back from one real scan of Food Basics.
    const a = deal({ merchantName: "Food Basics", name: "OÎKOS DRINKABLE GREEK YOGURT", priceCents: 299 });
    const b = deal({ merchantName: "Food Basics", name: "OIKOS DRINKABLE GREEK YOGURT", priceCents: 299 });
    expect(offerKey(a)).toBe(offerKey(b));

    const c = deal({ name: "LACTANTIA PURFILTRE MILK OR LACTOSE FREE MILK", priceCents: 498 });
    const d = deal({ name: "LACTANTIA PURFILTRE MILK, OR LACTOSE FREE MILK", priceCents: 498 });
    expect(offerKey(c)).toBe(offerKey(d));
  });

  it("keeps genuinely different offers apart", () => {
    const base = deal({ name: "SELECTION BACON", priceCents: 399 });
    expect(offerKey(base)).not.toBe(offerKey({ ...base, priceCents: 499 }));
    expect(offerKey(base)).not.toBe(offerKey({ ...base, merchantName: "No Frills" }));
    expect(offerKey(base)).not.toBe(offerKey({ ...base, validTo: "2026-10-01" }));
  });
});
