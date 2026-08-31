import { describe, expect, it } from "vitest";
import { describeScreen, mentions, screenMeal, type ScreenablePerson } from "./allergens";

const ella: ScreenablePerson = {
  id: "p1",
  name: "Ella",
  allergies: ["Peanut"],
  dislikes: ["Mushroom"],
};
const sam: ScreenablePerson = { id: "p2", name: "Sam", allergies: [], dislikes: ["Olives"] };

describe("mentions", () => {
  it("matches a whole word regardless of case or punctuation", () => {
    expect(mentions("Kraft Crunchy Peanut Butter", "peanut")).toBe(true);
    expect(mentions("PEANUT-BUTTER", "Peanut")).toBe(true);
  });

  it("matches across a simple plural on either side", () => {
    expect(mentions("Eggs", "Egg")).toBe(true);
    expect(mentions("Egg", "Eggs")).toBe(true);
  });

  it("does not match a longer word that merely contains the term", () => {
    // Substring matching makes "egg" hit "eggplant", and warnings people learn
    // to ignore are worse than no warnings.
    expect(mentions("Eggplant Parmesan", "egg")).toBe(false);
    expect(mentions("Butternut Squash", "nut")).toBe(false);
  });

  it("matches a multi-word allergen as a phrase", () => {
    expect(mentions("Tree Nut Mix", "tree nut")).toBe(true);
    expect(mentions("Nut and Tree Bark Tea", "tree nut")).toBe(false);
  });

  it("is empty-safe on both sides", () => {
    expect(mentions("", "peanut")).toBe(false);
    expect(mentions("Peanut Butter", "")).toBe(false);
    expect(mentions("Peanut Butter", "   ")).toBe(false);
  });
});

describe("screenMeal", () => {
  it("finds an allergen in an ingredient name and says whose it is", () => {
    const screen = screenMeal([{ name: "Peanut Butter" }, { name: "Bread" }], [ella]);
    expect(screen.allergens).toEqual([
      { personId: "p1", personName: "Ella", allergen: "Peanut", ingredient: "Peanut Butter" },
    ]);
    expect(screen.checked).toBe(true);
  });

  it("keeps dislikes separate from allergens", () => {
    const screen = screenMeal([{ name: "Mushroom Soup" }], [ella]);
    expect(screen.allergens).toEqual([]);
    expect(screen.dislikes).toHaveLength(1);
  });

  it("screens every person eating it, not just the first", () => {
    const screen = screenMeal([{ name: "Olives" }, { name: "Peanut Oil" }], [ella, sam]);
    expect(screen.allergens.map((a) => a.personName)).toEqual(["Ella"]);
    expect(screen.dislikes.map((d) => d.personName)).toEqual(["Sam"]);
  });

  it("reports unchecked for a recipe with no ingredients recorded", () => {
    // No hits here means nothing was read, not that nothing was found. The UI
    // has to be able to tell those apart.
    const screen = screenMeal([], [ella]);
    expect(screen.allergens).toEqual([]);
    expect(screen.checked).toBe(false);
  });

  it("reports unchecked when an ingredient has no readable name", () => {
    const screen = screenMeal([{ name: "Peanut Butter" }, { name: "   " }], [ella]);
    expect(screen.allergens).toHaveLength(1);
    expect(screen.checked).toBe(false);
  });

  it("is clear and checked when nothing matches", () => {
    const screen = screenMeal([{ name: "Rice" }, { name: "Chicken" }], [ella, sam]);
    expect(screen.allergens).toEqual([]);
    expect(screen.dislikes).toEqual([]);
    expect(screen.checked).toBe(true);
  });
});

describe("describeScreen", () => {
  it("names the person, the allergen and the ingredient", () => {
    const screen = screenMeal([{ name: "Peanut Butter" }], [ella]);
    expect(describeScreen(screen)).toBe("Ella is allergic to Peanut — this has Peanut Butter");
  });

  it("leads with allergens even when there are dislikes too", () => {
    const screen = screenMeal([{ name: "Peanut Butter" }, { name: "Olives" }], [ella, sam]);
    expect(describeScreen(screen)).toContain("allergic");
    expect(describeScreen(screen)).not.toContain("Olives");
  });

  it("says nothing when there is nothing to say", () => {
    expect(describeScreen(screenMeal([{ name: "Rice" }], [ella]))).toBeNull();
  });

  it("does not repeat an ingredient that matched twice", () => {
    const twice: ScreenablePerson = {
      id: "p3",
      name: "Jo",
      allergies: ["Peanut", "Butter"],
      dislikes: [],
    };
    expect(describeScreen(screenMeal([{ name: "Peanut Butter" }], [twice]))).toBe(
      "Jo is allergic to Peanut, Butter — this has Peanut Butter",
    );
  });
});
