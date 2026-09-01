import { describe, expect, it } from "vitest";
import {
  buildRegularBuyNotifications,
  buildTargetHitNotifications,
  type RegularBuyDeal,
  type WatchedPrice,
} from "./from-prices";

const watched: WatchedPrice[] = [
  { watchItemId: "a", title: "Bauer Skates", targetCents: 19999, observedCents: 17999, retailerName: "SportChek" },
  { watchItemId: "b", title: "Helmet", targetCents: 9999, observedCents: 12999, retailerName: "SportChek" },
  { watchItemId: "c", title: "Stick", targetCents: null, observedCents: 4999, retailerName: null },
  { watchItemId: "d", title: "Bag", targetCents: 5999, observedCents: null, retailerName: null },
];

describe("buildTargetHitNotifications", () => {
  it("fires when the price is at or below target", () => {
    const out = buildTargetHitNotifications(watched, new Set());
    expect(out.map((n) => n.watchItemId)).toEqual(["a"]);
    expect(out[0].body).toContain("$179.99");
    expect(out[0].body).toContain("SportChek");
  });

  it("fires on an exact match, not only below", () => {
    const out = buildTargetHitNotifications(
      [{ watchItemId: "x", title: "T", targetCents: 1000, observedCents: 1000, retailerName: null }],
      new Set(),
    );
    expect(out).toHaveLength(1);
  });

  it("says nothing when there is no target or no price", () => {
    const out = buildTargetHitNotifications(watched.slice(2), new Set());
    expect(out).toEqual([]);
  });

  it("does not repeat itself while one is still unread", () => {
    // An app that reports the same price every night teaches you to ignore it.
    expect(buildTargetHitNotifications(watched, new Set(["a"]))).toEqual([]);
  });
});

describe("buildRegularBuyNotifications", () => {
  const deals: RegularBuyDeal[] = [
    { catalogProductId: "p1", title: "Ketchup", priceCents: 349, retailerName: "Food Basics", previousBestCents: 449 },
    { catalogProductId: "p2", title: "Pasta", priceCents: 199, retailerName: "No Frills", previousBestCents: 199 },
    { catalogProductId: "p3", title: "Oil", priceCents: 599, retailerName: null, previousBestCents: null },
  ];

  it("mentions only what is cheaper than you have ever seen", () => {
    const out = buildRegularBuyNotifications(deals, new Set());
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Ketchup");
    expect(out[0].body).toContain("cheapest you've seen");
  });

  it("stays quiet when there is no history to beat", () => {
    // Being in a flyer is not news; being cheaper than you've ever paid is.
    const out = buildRegularBuyNotifications([deals[2]], new Set());
    expect(out).toEqual([]);
  });

  it("does not repeat an item already mentioned", () => {
    expect(buildRegularBuyNotifications(deals, new Set(["p1"]))).toEqual([]);
  });
});
