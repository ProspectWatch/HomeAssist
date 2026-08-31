import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  stripParentheticals,
  matchIngredient,
  mentions,
  needsBuying,
  normalise,
  stockFor,
  type PantryEntry,
} from "./ingredient-match";

const pantry: PantryEntry[] = [
  { title: "Olive Oil", catalogProductId: "oil", status: "IN_STOCK" },
  { title: "Garlic", catalogProductId: "garlic", status: "LOW" },
  { title: "Potatoes", catalogProductId: "potato", status: "OUT" },
  { title: "Yukon Gold Potatoes", catalogProductId: "yukon", status: "IN_STOCK" },
  { title: "Kosher Salt", catalogProductId: "salt", status: "IN_STOCK" },
  { title: "Salted Butter", catalogProductId: "butter", status: "UNKNOWN" },
];

describe("decodeEntities", () => {
  it("decodes the numeric apostrophe that arrives in imported recipes", () => {
    expect(decodeEntities("Portugal&#39;s yellow potatoes")).toBe("Portugal's yellow potatoes");
  });

  it("decodes hex and named entities", () => {
    expect(decodeEntities("caf&#xe9; &amp; cream")).toBe("café & cream");
  });

  it("does not turn a literal &amp;#39; into an apostrophe", () => {
    expect(decodeEntities("&amp;#39;")).toBe("&#39;");
  });
});

describe("mentions", () => {
  it("finds a pantry name inside a prose ingredient line", () => {
    expect(mentions("1/4 cup extra-virgin olive oil", "Olive Oil")).toBe(true);
  });

  it("tolerates plurals", () => {
    expect(mentions("6 medium potatoes (peeled)", "Potato")).toBe(true);
  });

  it("does not match inside a longer word", () => {
    expect(mentions("2 tbsp salted butter", "Salt")).toBe(false);
  });

  it("requires every word of the phrase, in order", () => {
    expect(mentions("2 pounds gold potatoes", "Yukon Gold Potatoes")).toBe(false);
  });

  it("reads through HTML entities", () => {
    expect(mentions("Portugal&#39;s yellow potatoes", "Potatoes")).toBe(true);
  });
});

describe("matchIngredient", () => {
  it("prefers an ingredient's linked catalogue product over any reading", () => {
    const match = matchIngredient({ name: "a splash of something", catalogProductId: "oil" }, pantry);
    expect(match.how).toBe("catalogue");
    expect(match.entry?.title).toBe("Olive Oil");
  });

  it("falls back to reading the line", () => {
    const match = matchIngredient(
      { name: "2 garlic cloves (sliced)", catalogProductId: null },
      pantry,
    );
    expect(match.how).toBe("name");
    expect(match.entry?.title).toBe("Garlic");
  });

  it("prefers the longer pantry name when both appear", () => {
    const match = matchIngredient(
      { name: "2 pounds Yukon gold potatoes, peeled", catalogProductId: null },
      pantry,
    );
    expect(match.entry?.title).toBe("Yukon Gold Potatoes");
  });

  it("reports nothing rather than guessing", () => {
    const match = matchIngredient(
      { name: "1/4 cup red pepper paste", catalogProductId: null },
      pantry,
    );
    expect(match.entry).toBeNull();
    expect(match.how).toBe("none");
  });

  it("falls back to the name when the linked product is not in the pantry", () => {
    const match = matchIngredient(
      { name: "3 cloves garlic", catalogProductId: "not-in-pantry" },
      pantry,
    );
    expect(match.how).toBe("name");
    expect(match.entry?.title).toBe("Garlic");
  });
});

describe("stripParentheticals", () => {
  it("drops an aside", () => {
    expect(stripParentheticals("3 cloves garlic (minced)")).toBe("3 cloves garlic ");
  });

  it("handles nesting", () => {
    expect(stripParentheticals("Wine vinegar (to drizzle (optional))")).toBe("Wine vinegar ");
  });

  it("keeps the line when stripping would empty it", () => {
    expect(stripParentheticals("(optional)")).toBe("(optional)");
  });
});

describe("matchIngredient ignores parenthetical asides", () => {
  // Both of these are real lines from this household's imported recipes, and
  // both matched the wrong pantry item before asides were stripped.
  it("does not read clam varieties as butter", () => {
    const match = matchIngredient(
      {
        name: "3 1/4 pounds small clams (such as cockles, manila, butter, or littlenecks, scrubbed)",
        catalogProductId: null,
      },
      pantry,
    );
    expect(match.entry).toBeNull();
  });

  it("does not read water as chicken broth", () => {
    const broth: PantryEntry[] = [
      ...pantry,
      { title: "Chicken Broth", catalogProductId: "broth", status: "IN_STOCK" },
    ];
    const match = matchIngredient(
      {
        name: "8 cups cold water (or half homemade chicken stock or canned chicken broth, and half water)",
        catalogProductId: null,
      },
      broth,
    );
    expect(match.entry).toBeNull();
  });

  it("still reads the head of the line", () => {
    const match = matchIngredient(
      { name: "6 medium potatoes (peeled and roughly chopped)", catalogProductId: null },
      pantry,
    );
    expect(match.entry?.title).toBe("Potatoes");
  });
});

describe("stockFor", () => {
  it("calls an unmatched ingredient untracked, never out", () => {
    expect(stockFor({ entry: null, how: "none" })).toBe("UNTRACKED");
  });

  it("carries the pantry's own status through", () => {
    expect(stockFor({ entry: pantry[2], how: "name" })).toBe("OUT");
    expect(stockFor({ entry: pantry[0], how: "catalogue" })).toBe("IN_STOCK");
  });
});

describe("needsBuying", () => {
  it("is true for low and out", () => {
    expect(needsBuying("LOW")).toBe(true);
    expect(needsBuying("OUT")).toBe(true);
  });

  it("is false for what we have, and for what we simply don't know", () => {
    expect(needsBuying("IN_STOCK")).toBe(false);
    expect(needsBuying("UNKNOWN")).toBe(false);
    expect(needsBuying("UNTRACKED")).toBe(false);
  });
});

describe("normalise", () => {
  it("flattens curly quotes so they match straight ones", () => {
    expect(normalise("don’t")).toBe("don't");
  });
});
