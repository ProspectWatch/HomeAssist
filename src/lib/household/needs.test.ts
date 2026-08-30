import { describe, expect, it } from "vitest";
import { resolveNeedMatch, type ActiveListItem, type HouseholdNeed } from "./needs";

// TEST FIXTURES — not household data. Stand-ins for grocery rows and needs.
const eggsOnList: ActiveListItem = {
  id: "row-eggs",
  name: "Eggs",
  catalogProductId: "conestoga-brown-free-range-eggs",
};
const customNote: ActiveListItem = { id: "row-custom", name: "Birthday candles", catalogProductId: null };
const unlinkedEggs: ActiveListItem = { id: "row-legacy-eggs", name: "Eggs", catalogProductId: null };

function need(partial: Partial<HouseholdNeed>): HouseholdNeed {
  return { catalogProductId: null, name: "Something", source: "PANTRY", ...partial };
}

describe("resolveNeedMatch — duplicate protection", () => {
  it("recognizes the same catalogue product already on the list", () => {
    const match = resolveNeedMatch([eggsOnList, customNote], {
      ...need({ catalogProductId: "conestoga-brown-free-range-eggs", name: "Eggs" }),
    });
    expect(match.kind).toBe("existing");
    if (match.kind === "existing") expect(match.itemId).toBe("row-eggs");
  });

  it("stays a single row when the same need is added twice", () => {
    const first = resolveNeedMatch([], need({ catalogProductId: "garbage-bags", name: "Garbage Bags" }));
    expect(first.kind).toBe("create");

    // Simulating the row the first call would have created.
    const afterFirst: ActiveListItem[] = [
      { id: "row-bags", name: "Garbage Bags", catalogProductId: "garbage-bags" },
    ];
    const second = resolveNeedMatch(afterFirst, need({ catalogProductId: "garbage-bags", name: "Garbage Bags" }));
    expect(second.kind).toBe("existing");
  });

  it("matches a catalogue need to an unlinked row with the exact same name", () => {
    const match = resolveNeedMatch([unlinkedEggs], {
      ...need({ catalogProductId: "conestoga-brown-free-range-eggs", name: "eggs" }),
    });
    expect(match.kind).toBe("existing");
    if (match.kind === "existing") expect(match.itemId).toBe("row-legacy-eggs");
  });

  it("creates a new row for a different catalogue product", () => {
    const match = resolveNeedMatch([eggsOnList], {
      ...need({ catalogProductId: "earth-s-own-original-almond-milk", name: "Almond Milk" }),
    });
    expect(match.kind).toBe("create");
  });

  it("never merges a custom item into a catalogue-backed row", () => {
    // A hand-typed "Eggs" must not hijack the catalogue-backed Eggs row's
    // identity — catalogue rows are only matched via catalogue identity.
    const match = resolveNeedMatch([eggsOnList], need({ catalogProductId: null, name: "Eggs" }));
    expect(match.kind).toBe("create");
  });

  it("does not merge unrelated custom items with similar-looking names", () => {
    const list: ActiveListItem[] = [{ id: "row-noodles", name: "Egg noodles", catalogProductId: null }];
    const match = resolveNeedMatch(list, need({ catalogProductId: null, name: "Eggs" }));
    expect(match.kind).toBe("create");
  });

  it("dedupes an identical custom item regardless of case and spacing", () => {
    const match = resolveNeedMatch([customNote], need({ catalogProductId: null, name: "  birthday   candles " }));
    expect(match.kind).toBe("existing");
    if (match.kind === "existing") expect(match.itemId).toBe("row-custom");
  });

  it("treats a checked-off list as empty (only active rows are passed in)", () => {
    const match = resolveNeedMatch([], need({ catalogProductId: "conestoga-brown-free-range-eggs", name: "Eggs" }));
    expect(match.kind).toBe("create");
  });
});
