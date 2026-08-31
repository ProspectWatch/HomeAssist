import { describe, expect, it } from "vitest";
import { buildScanTargets } from "./ingestion";

describe("buildScanTargets — branded queries", () => {
  const names = new Map([
    ["corn-chips", "Corn Chips"],
    ["peanut-butter", "Peanut Butter"],
  ]);

  const empty = {
    groceryListCatalogIds: [],
    outCatalogIds: [],
    lowCatalogIds: [],
    regularBuyCatalogIds: [],
    preferenceCatalogIds: [],
    watchCatalogIds: [],
    recipeCatalogIds: [],
    namesById: names,
  };

  it("searches the brand the household buys, not the catalogue heading", () => {
    // The two find different things: "Corn Chips" returns whatever a flyer
    // files under that heading, "Doritos" returns the bag on their shelf.
    const targets = buildScanTargets({
      ...empty,
      watchCatalogIds: ["corn-chips"],
      brandNamesById: new Map([["corn-chips", "Doritos Nacho Cheese Tortilla Chips"]]),
    });
    expect(targets).toEqual([
      {
        catalogProductId: "corn-chips",
        query: "Doritos Nacho Cheese Tortilla Chips",
        reason: "WATCH",
      },
    ]);
  });

  it("falls back to the catalogue name where no brand is named", () => {
    const targets = buildScanTargets({
      ...empty,
      watchCatalogIds: ["corn-chips", "peanut-butter"],
      brandNamesById: new Map([["corn-chips", "Doritos"]]),
    });
    expect(targets.map((t) => t.query)).toEqual(["Doritos", "Peanut Butter"]);
  });

  it("still scans a concept once when several branded products share it", () => {
    // Crunchy and Smooth are two products over one catalogue concept; the scan
    // budget is better spent reaching more products than asking twice.
    const targets = buildScanTargets({
      ...empty,
      regularBuyCatalogIds: ["peanut-butter", "peanut-butter"],
      brandNamesById: new Map([["peanut-butter", "Kraft Crunchy Peanut Butter"]]),
    });
    expect(targets).toHaveLength(1);
    expect(targets[0].query).toBe("Kraft Crunchy Peanut Butter");
  });

  it("is unaffected when the household has named no brands at all", () => {
    const targets = buildScanTargets({ ...empty, watchCatalogIds: ["corn-chips"] });
    expect(targets[0].query).toBe("Corn Chips");
  });
});
