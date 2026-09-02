import { describe, expect, it } from "vitest";
import {
  isInformative,
  rankOf,
  sortByUsefulness,
  MAX_UNPRICED_RESULTS,
  type PricedResult,
} from "./ranking";

const result = (over: Partial<PricedResult> = {}): PricedResult => ({
  deal: null,
  sub: null,
  isRegularBuy: false,
  hasPrice: false,
  ...over,
});

describe("isInformative", () => {
  it("keeps a product with a price", () => {
    expect(isInformative(result({ hasPrice: true }))).toBe(true);
  });

  it("keeps a regular buy even with no price on record", () => {
    expect(isInformative(result({ isRegularBuy: true }))).toBe(true);
  });

  it("sets aside a bare catalogue entry", () => {
    // The measured case: "steak" matched 17 catalogue products and not one of
    // them had ever carried a price.
    expect(isInformative(result())).toBe(false);
  });
});

describe("rankOf", () => {
  it("puts a live sale above a known usual price", () => {
    expect(rankOf(result({ deal: "on sale $4.99 at Fortinos", hasPrice: true }))).toBeLessThan(
      rankOf(result({ sub: "Produce · usually $3.49", hasPrice: true })),
    );
  });

  it("puts a known price above a regular buy with no price", () => {
    expect(rankOf(result({ sub: "Meat · usually $12.99", hasPrice: true }))).toBeLessThan(
      rankOf(result({ isRegularBuy: true })),
    );
  });

  it("lifts a regular buy above an equal result that isn't one", () => {
    expect(rankOf(result({ deal: "on sale $4.99", isRegularBuy: true, hasPrice: true }))).toBeLessThan(
      rankOf(result({ deal: "on sale $4.99", hasPrice: true })),
    );
  });
});

describe("sortByUsefulness", () => {
  it("orders sale, then priced, then regular buy, then the rest", () => {
    const rows = [
      { name: "nothing known", ...result() },
      { name: "regular buy", ...result({ isRegularBuy: true }) },
      { name: "usual price", ...result({ sub: "usually $3.49", hasPrice: true }) },
      { name: "on sale", ...result({ deal: "on sale $2.99", hasPrice: true }) },
    ];
    expect(sortByUsefulness(rows).map((r) => r.name)).toEqual([
      "on sale",
      "usual price",
      "regular buy",
      "nothing known",
    ]);
  });

  it("does not mutate its input", () => {
    const rows = [result({ sub: "usually $1" , hasPrice: true }), result({ deal: "on sale $1", hasPrice: true })];
    const before = [...rows];
    sortByUsefulness(rows);
    expect(rows).toEqual(before);
  });
});

it("caps the unpriced tail", () => {
  expect(MAX_UNPRICED_RESULTS).toBe(8);
});
