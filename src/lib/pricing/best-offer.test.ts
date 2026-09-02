import { describe, expect, it } from "vitest";
import {
  ageInDays,
  bestOfferByProduct,
  classifySource,
  describeOffer,
  isExpired,
  type ProductOffer,
} from "./best-offer";

const TODAY = "2026-09-02";

function offer(over: Partial<ProductOffer> = {}): ProductOffer {
  return {
    catalogProductId: "p1",
    priceCents: 499,
    retailerName: "Food Basics",
    source: "FLYER",
    observedOn: TODAY,
    validUntil: null,
    ...over,
  };
}

describe("classifySource", () => {
  it("treats Marilu's Instacart prices as a shop's current price, not a sale", () => {
    // The bug this fixes: search filtered to FLYER, so 30 Marilu's prices in
    // the same table were invisible.
    expect(classifySource("adapter:instacart")).toBe("ONLINE");
  });

  it("keeps flyers, receipts and manual entries distinct", () => {
    expect(classifySource("FLYER")).toBe("FLYER");
    expect(classifySource("RECEIPT")).toBe("RECEIPT");
    expect(classifySource("MANUAL")).toBe("MANUAL");
    expect(classifySource("ONLINE")).toBe("ONLINE");
  });
});

describe("isExpired", () => {
  it("drops an offer whose end date has passed", () => {
    expect(isExpired(offer({ validUntil: "2026-09-01" }), TODAY)).toBe(true);
  });

  it("keeps one ending today", () => {
    expect(isExpired(offer({ validUntil: TODAY }), TODAY)).toBe(false);
  });

  it("keeps one with no stated end", () => {
    expect(isExpired(offer({ validUntil: null }), TODAY)).toBe(false);
  });
});

describe("bestOfferByProduct", () => {
  it("picks the cheapest across sources, not just flyers", () => {
    const best = bestOfferByProduct(
      [
        offer({ priceCents: 599, source: "FLYER", retailerName: "Fortinos" }),
        offer({ priceCents: 449, source: "ONLINE", retailerName: "Marilu's Market" }),
      ],
      TODAY,
    );
    expect(best.get("p1")?.retailerName).toBe("Marilu's Market");
  });

  it("ignores an expired offer even when it is cheapest", () => {
    const best = bestOfferByProduct(
      [
        offer({ priceCents: 199, validUntil: "2026-08-01" }),
        offer({ priceCents: 499, validUntil: null }),
      ],
      TODAY,
    );
    expect(best.get("p1")?.priceCents).toBe(499);
  });

  it("breaks a tie towards the sale, which is the one with an end date", () => {
    const best = bestOfferByProduct(
      [
        offer({ priceCents: 499, source: "ONLINE", retailerName: "Walmart" }),
        offer({ priceCents: 499, source: "FLYER", retailerName: "No Frills" }),
      ],
      TODAY,
    );
    expect(best.get("p1")?.retailerName).toBe("No Frills");
  });

  it("returns nothing for a product with only expired offers", () => {
    const best = bestOfferByProduct([offer({ validUntil: "2026-01-01" })], TODAY);
    expect(best.has("p1")).toBe(false);
  });
});

describe("describeOffer", () => {
  it("calls a flyer price a sale", () => {
    expect(describeOffer(offer(), TODAY)).toBe("on sale $4.99 at Food Basics");
  });

  it("states a shop price plainly", () => {
    expect(describeOffer(offer({ source: "ONLINE", retailerName: "Marilu's Market" }), TODAY)).toBe(
      "$4.99 at Marilu's Market",
    );
  });

  it("says what you paid, when that is the evidence", () => {
    expect(describeOffer(offer({ source: "RECEIPT", retailerName: "Costco" }), TODAY)).toBe(
      "you paid $4.99 at Costco",
    );
  });

  it("dates a stale price instead of passing it off as current", () => {
    const text = describeOffer(offer({ observedOn: "2026-08-01" }), TODAY);
    expect(text).toContain("seen 2026-08-01");
  });

  it("leaves a fresh price undated", () => {
    expect(describeOffer(offer({ observedOn: "2026-08-28" }), TODAY)).not.toContain("seen");
  });
});

describe("ageInDays", () => {
  it("counts days", () => {
    expect(ageInDays("2026-08-28", TODAY)).toBe(5);
  });

  it("treats an unreadable date as infinitely old rather than fresh", () => {
    expect(ageInDays("nonsense", TODAY)).toBe(Number.POSITIVE_INFINITY);
  });
});
