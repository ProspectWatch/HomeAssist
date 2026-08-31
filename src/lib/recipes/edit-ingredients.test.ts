import { describe, expect, it } from "vitest";
import { planIngredientEdit, type ExistingIngredient } from "./edit-ingredients";

const existing: ExistingIngredient[] = [
  { id: "a", name: "1/4 cup olive oil" },
  { id: "b", name: "2 garlic cloves" },
  { id: "c", name: "6 medium potatoes" },
];

describe("planIngredientEdit", () => {
  it("keeps untouched lines so their catalogue links survive", () => {
    const plan = planIngredientEdit(existing, [
      "1/4 cup olive oil",
      "2 garlic cloves",
      "6 medium potatoes",
    ]);
    expect(plan.keep.map((k) => k.id)).toEqual(["a", "b", "c"]);
    expect(plan.insert).toEqual([]);
    expect(plan.deleteIds).toEqual([]);
  });

  it("renumbers when lines are reordered, without deleting anything", () => {
    const plan = planIngredientEdit(existing, [
      "6 medium potatoes",
      "1/4 cup olive oil",
      "2 garlic cloves",
    ]);
    expect(plan.keep).toEqual([
      { id: "c", name: "6 medium potatoes", sortOrder: 0 },
      { id: "a", name: "1/4 cup olive oil", sortOrder: 1 },
      { id: "b", name: "2 garlic cloves", sortOrder: 2 },
    ]);
    expect(plan.deleteIds).toEqual([]);
  });

  it("inserts a new line and keeps the rest", () => {
    const plan = planIngredientEdit(existing, [
      "1/4 cup olive oil",
      "2 garlic cloves",
      "6 medium potatoes",
      "kosher salt",
    ]);
    expect(plan.insert).toEqual([{ name: "kosher salt", sortOrder: 3 }]);
    expect(plan.deleteIds).toEqual([]);
  });

  it("deletes a removed line", () => {
    const plan = planIngredientEdit(existing, ["1/4 cup olive oil", "6 medium potatoes"]);
    expect(plan.deleteIds).toEqual(["b"]);
    expect(plan.keep.map((k) => k.id)).toEqual(["a", "c"]);
  });

  it("ignores case and stray whitespace rather than churning rows", () => {
    const plan = planIngredientEdit(existing, [
      "  1/4 CUP   olive oil ",
      "2 garlic cloves",
      "6 medium potatoes",
    ]);
    expect(plan.keep.map((k) => k.id)).toEqual(["a", "b", "c"]);
    expect(plan.deleteIds).toEqual([]);
  });

  it("treats an edited line as a removal plus an addition", () => {
    // The text no longer says what it said, so the old catalogue link is no
    // longer known to be right — losing it beats moving it to the wrong thing.
    const plan = planIngredientEdit(existing, [
      "1/2 cup olive oil",
      "2 garlic cloves",
      "6 medium potatoes",
    ]);
    expect(plan.deleteIds).toEqual(["a"]);
    expect(plan.insert).toEqual([{ name: "1/2 cup olive oil", sortOrder: 0 }]);
  });

  it("drops blank lines", () => {
    const plan = planIngredientEdit(existing, [
      "1/4 cup olive oil",
      "",
      "   ",
      "2 garlic cloves",
      "6 medium potatoes",
    ]);
    expect(plan.keep.map((k) => k.sortOrder)).toEqual([0, 1, 2]);
    expect(plan.insert).toEqual([]);
  });

  it("collapses a repeated line", () => {
    const plan = planIngredientEdit(existing, [
      "1/4 cup olive oil",
      "1/4 cup olive oil",
      "2 garlic cloves",
      "6 medium potatoes",
    ]);
    expect(plan.keep.map((k) => k.id)).toEqual(["a", "b", "c"]);
    expect(plan.insert).toEqual([]);
  });

  it("deletes everything when the list is emptied", () => {
    const plan = planIngredientEdit(existing, []);
    expect(plan.deleteIds.sort()).toEqual(["a", "b", "c"]);
    expect(plan.keep).toEqual([]);
  });

  it("keeps one of a genuinely duplicated existing row and deletes the other", () => {
    const dupes: ExistingIngredient[] = [
      { id: "x", name: "salt" },
      { id: "y", name: "Salt" },
    ];
    const plan = planIngredientEdit(dupes, ["salt"]);
    expect(plan.keep.map((k) => k.id)).toEqual(["x"]);
    expect(plan.deleteIds).toEqual(["y"]);
  });
});
