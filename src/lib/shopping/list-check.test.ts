import { describe, expect, it } from "vitest";
import { isStale, verdictFor, type ListItemCheck, type StoreSighting } from "./list-check";

const marilus: StoreSighting = { retailerId: "m", retailerName: "Marilu's", priceCents: 1299, seenOn: "2026-09-01" };
const fortinos: StoreSighting = { retailerId: "f", retailerName: "Fortinos", priceCents: 999, seenOn: "2026-09-01" };

function check(over: Partial<ListItemCheck> = {}): ListItemCheck {
  return {
    itemId: "1",
    name: "Steak",
    taggedRetailerId: "m",
    taggedRetailerName: "Marilu's",
    sightings: [fortinos, marilus],
    cheapest: fortinos,
    atTagged: marilus,
    ...over,
  };
}

describe("verdictFor", () => {
  it("says nothing is known rather than implying a price", () => {
    const v = verdictFor(check({ sightings: [], cheapest: null, atTagged: null }));
    expect(v.kind).toBe("none");
    expect(v.text).toContain("No price recorded");
  });

  it("reports a saving only when the tagged store has been priced too", () => {
    const v = verdictFor(check());
    expect(v.kind).toBe("cheaper-elsewhere");
    if (v.kind === "cheaper-elsewhere") expect(v.savingCents).toBe(300);
    expect(v.text).toContain("Fortinos");
    expect(v.text).toContain("Marilu's");
  });

  it("does not claim a saving against a store that has never been priced", () => {
    // Comparing a priced shop with an unpriced one is not a comparison, and
    // calling it a saving sends somebody across town on no evidence.
    const v = verdictFor(check({ atTagged: null }));
    expect(v.kind).toBe("only");
    expect(v.text).toContain("no price recorded at Marilu's");
  });

  it("confirms when the store you use is already the cheapest", () => {
    const v = verdictFor(check({ cheapest: marilus, atTagged: marilus, sightings: [marilus] }));
    expect(v.kind).toBe("matches");
    expect(v.text).toContain("cheapest you've seen");
  });

  it("reads plainly with no tagged store at all", () => {
    const v = verdictFor(check({ taggedRetailerId: null, taggedRetailerName: null, atTagged: null }));
    expect(v.text).toBe("$9.99 at Fortinos");
  });
});

describe("isStale", () => {
  it("counts a fortnight as still current", () => {
    expect(isStale("2026-08-20", "2026-09-01")).toBe(false);
  });

  it("flags anything older", () => {
    expect(isStale("2026-08-01", "2026-09-01")).toBe(true);
  });

  it("treats an unreadable date as stale rather than fresh", () => {
    expect(isStale("not a date", "2026-09-01")).toBe(true);
  });
});
