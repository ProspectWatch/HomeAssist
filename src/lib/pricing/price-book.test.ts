import { describe, expect, it } from "vitest";
import {
  assessPrice,
  buildPriceBook,
  buildPriceBookEntry,
  confidenceFor,
  isNotable,
  median,
  type PriceSighting,
} from "./price-book";

function sighting(overrides: Partial<PriceSighting> & { priceCents: number; observedOn: string }): PriceSighting {
  return {
    catalogProductId: "milk-2l",
    retailerName: "Fortinos",
    kind: "paid",
    onPromotion: false,
    receiptId: null,
    ...overrides,
  };
}

describe("median", () => {
  it("returns a price that was actually paid, even for an even count", () => {
    expect(median([100, 200, 300, 400])).toBe(200);
    expect([100, 200, 300, 400]).toContain(median([100, 200, 300, 400]));
  });

  it("is unmoved by one extreme clearance price", () => {
    expect(median([499, 499, 529, 549, 19])).toBe(499);
  });
});

describe("confidenceFor", () => {
  it("never claims confidence it hasn't earned", () => {
    expect(confidenceFor(0)).toBe("NONE");
    expect(confidenceFor(1)).toBe("THIN");
    expect(confidenceFor(2)).toBe("THIN");
    expect(confidenceFor(3)).toBe("FAIR");
    expect(confidenceFor(5)).toBe("FAIR");
    expect(confidenceFor(6)).toBe("GOOD");
  });
});

describe("buildPriceBookEntry", () => {
  it("returns null rather than an empty-looking entry when there is nothing", () => {
    expect(buildPriceBookEntry([])).toBeNull();
  });

  it("summarises real sightings without inventing any", () => {
    const entry = buildPriceBookEntry([
      sighting({ priceCents: 549, observedOn: "2026-01-10" }),
      sighting({ priceCents: 499, observedOn: "2026-02-14", retailerName: "No Frills" }),
      sighting({ priceCents: 529, observedOn: "2026-03-01" }),
    ])!;

    expect(entry.sightings).toBe(3);
    expect(entry.lastCents).toBe(529);
    expect(entry.lastOn).toBe("2026-03-01");
    expect(entry.typicalCents).toBe(529);
    expect(entry.lowestCents).toBe(499);
    expect(entry.lowestRetailer).toBe("No Frills");
    expect(entry.highestCents).toBe(549);
    expect(entry.spreadCents).toBe(50);
    expect(entry.confidence).toBe("FAIR");
  });

  it("ranks retailers by the best price actually seen at each", () => {
    const entry = buildPriceBookEntry([
      sighting({ priceCents: 549, observedOn: "2026-01-10", retailerName: "Fortinos" }),
      sighting({ priceCents: 599, observedOn: "2026-01-20", retailerName: "Fortinos" }),
      sighting({ priceCents: 479, observedOn: "2026-02-01", retailerName: "No Frills" }),
    ])!;

    expect(entry.retailers.map((r) => r.name)).toEqual(["No Frills", "Fortinos"]);
    expect(entry.retailers[1].bestCents).toBe(549);
    expect(entry.retailers[1].sightings).toBe(2);
  });

  it("counts paid and seen sightings separately", () => {
    const entry = buildPriceBookEntry([
      sighting({ priceCents: 549, observedOn: "2026-01-10" }),
      sighting({ priceCents: 499, observedOn: "2026-02-01", kind: "seen" }),
    ])!;

    expect(entry.sightings).toBe(2);
    expect(entry.paidSightings).toBe(1);
  });
});

describe("buildPriceBook", () => {
  it("keeps each product's history separate", () => {
    const book = buildPriceBook([
      sighting({ priceCents: 549, observedOn: "2026-01-10" }),
      sighting({ catalogProductId: "eggs-dozen", priceCents: 429, observedOn: "2026-01-10" }),
    ]);

    expect([...book.keys()].sort()).toEqual(["eggs-dozen", "milk-2l"]);
    expect(book.get("eggs-dozen")!.lowestCents).toBe(429);
  });
});

describe("assessPrice", () => {
  const solid = buildPriceBookEntry([
    sighting({ priceCents: 549, observedOn: "2026-01-05" }),
    sighting({ priceCents: 529, observedOn: "2026-01-20" }),
    sighting({ priceCents: 549, observedOn: "2026-02-02" }),
    sighting({ priceCents: 499, observedOn: "2026-02-18", retailerName: "No Frills" }),
    sighting({ priceCents: 549, observedOn: "2026-03-04" }),
    sighting({ priceCents: 559, observedOn: "2026-03-20" }),
  ])!;

  it("says so plainly when there is no history", () => {
    const verdict = assessPrice(null, 499);
    expect(verdict.code).toBe("NO_HISTORY");
    expect(verdict.confidence).toBe("NONE");
    expect(verdict.vsTypicalCents).toBeNull();
  });

  it("calls a new low the best price seen, naming the previous best", () => {
    const verdict = assessPrice(solid, 449);
    expect(verdict.code).toBe("BEST_EVER");
    expect(verdict.headline).toBe("Best price you've seen");
    expect(verdict.detail).toContain("$4.99");
    expect(verdict.detail).toContain("No Frills");
    expect(verdict.vsLowestCents).toBe(-50);
  });

  it("distinguishes matching the best price from beating it", () => {
    expect(assessPrice(solid, 499).headline).toBe("Matches your best price");
  });

  it("calls a meaningful discount off the usual price a good one", () => {
    // Needs a book whose best price sits well under the usual one, otherwise
    // any price cheap enough to be GOOD is also a new low, and BEST_EVER —
    // the stronger, better-evidenced claim — correctly wins.
    const wide = buildPriceBookEntry([
      sighting({ priceCents: 549, observedOn: "2026-01-05" }),
      sighting({ priceCents: 549, observedOn: "2026-01-20" }),
      sighting({ priceCents: 559, observedOn: "2026-02-02" }),
      sighting({ priceCents: 469, observedOn: "2026-02-18", retailerName: "No Frills" }),
      sighting({ priceCents: 549, observedOn: "2026-03-04" }),
    ])!;

    const verdict = assessPrice(wide, 489);
    expect(verdict.code).toBe("GOOD");
    expect(verdict.vsTypicalCents).toBe(-60);
    expect(verdict.detail).toContain("11% off");
  });

  it("prefers the stronger claim when a price is both a new low and a good one", () => {
    expect(assessPrice(solid, 400).code).toBe("BEST_EVER");
  });

  it("flags a price above the usual range", () => {
    const verdict = assessPrice(solid, 619);
    expect(verdict.code).toBe("HIGH");
    expect(verdict.detail).toContain("$5.49");
  });

  it("treats a small wobble around the usual price as normal", () => {
    expect(assessPrice(solid, 549).code).toBe("TYPICAL");
    expect(assessPrice(solid, 559).code).toBe("TYPICAL");
  });

  it("refuses to sound confident on a single sighting", () => {
    const thin = buildPriceBookEntry([sighting({ priceCents: 549, observedOn: "2026-01-05" })])!;
    const verdict = assessPrice(thin, 449);
    expect(verdict.code).toBe("BEST_EVER");
    expect(verdict.confidence).toBe("THIN");
    expect(verdict.headline).toBe("Cheaper than you've paid");
    expect(verdict.detail).toContain("isn't enough");
  });

  it("states the evidence behind every verdict it does give", () => {
    expect(assessPrice(solid, 549).detail).toContain("Recorded 6 times");
  });
});

describe("isNotable", () => {
  const thin = buildPriceBookEntry([sighting({ priceCents: 549, observedOn: "2026-01-05" })])!;
  const solid = buildPriceBookEntry([
    sighting({ priceCents: 549, observedOn: "2026-01-05" }),
    sighting({ priceCents: 529, observedOn: "2026-01-20" }),
    sighting({ priceCents: 549, observedOn: "2026-02-02" }),
  ])!;

  it("keeps thin-evidence calls out of review lists", () => {
    expect(isNotable(assessPrice(thin, 449))).toBe(false);
    expect(isNotable(assessPrice(thin, 999))).toBe(false);
  });

  it("surfaces well-evidenced highs and lows", () => {
    expect(isNotable(assessPrice(solid, 449))).toBe(true);
    expect(isNotable(assessPrice(solid, 699))).toBe(true);
  });

  it("stays quiet about ordinary prices", () => {
    expect(isNotable(assessPrice(solid, 549))).toBe(false);
    expect(isNotable(assessPrice(null, 549))).toBe(false);
  });
});
