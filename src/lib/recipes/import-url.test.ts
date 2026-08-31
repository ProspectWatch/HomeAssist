import { describe, expect, it } from "vitest";
import {
  checkRecipeUrl,
  extractJsonLd,
  parseIsoDuration,
  parseRecipeFromHtml,
} from "./import-url";

function page(jsonLd: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body>x</body></html>`;
}

const RECIPE = {
  "@type": "Recipe",
  name: "Sheet-Pan Salmon",
  totalTime: "PT35M",
  recipeYield: "4 servings",
  recipeIngredient: ["2 salmon fillets", "1 lemon", "Olive oil"],
};

describe("checkRecipeUrl", () => {
  it("accepts an ordinary https recipe link", () => {
    const result = checkRecipeUrl("https://www.example.com/recipes/salmon");
    expect(result.ok).toBe(true);
  });

  it("rejects anything that isn't a URL", () => {
    expect(checkRecipeUrl("salmon recipe").ok).toBe(false);
    expect(checkRecipeUrl("").ok).toBe(false);
  });

  it("rejects non-web schemes", () => {
    // file:// would read the server's disk; javascript: is not a fetch at all.
    expect(checkRecipeUrl("file:///etc/passwd").ok).toBe(false);
    expect(checkRecipeUrl("javascript:alert(1)").ok).toBe(false);
    expect(checkRecipeUrl("ftp://example.com/x").ok).toBe(false);
  });

  it("refuses to fetch the machine it is running on", () => {
    expect(checkRecipeUrl("http://localhost:3000/admin").ok).toBe(false);
    expect(checkRecipeUrl("http://127.0.0.1/").ok).toBe(false);
    expect(checkRecipeUrl("http://[::1]/").ok).toBe(false);
  });

  it("refuses private network ranges", () => {
    for (const host of ["10.0.0.5", "192.168.1.1", "172.16.4.4", "172.31.255.1"]) {
      expect(checkRecipeUrl(`http://${host}/x`).ok).toBe(false);
    }
  });

  it("refuses the cloud metadata address", () => {
    // 169.254.169.254 is how a server is talked into handing over its own
    // credentials, and it is reachable from inside most deployments.
    expect(checkRecipeUrl("http://169.254.169.254/latest/meta-data/").ok).toBe(false);
    expect(checkRecipeUrl("http://metadata.google.internal/").ok).toBe(false);
  });

  it("refuses a private address dressed as IPv4-mapped IPv6", () => {
    // ::ffff:7f00:1 is 127.0.0.1, and it is what a URL parser normalises
    // ::ffff:127.0.0.1 into — a guard reading only dotted quads waves it
    // straight through. This was a real hole here before it was a test.
    expect(checkRecipeUrl("http://[::ffff:127.0.0.1]/").ok).toBe(false);
    expect(checkRecipeUrl("http://[::ffff:7f00:1]/").ok).toBe(false);
    expect(checkRecipeUrl("http://[::ffff:169.254.169.254]/").ok).toBe(false);
    expect(checkRecipeUrl("http://[::ffff:a9fe:a9fe]/").ok).toBe(false);
  });

  it("refuses the other IPv6 ranges that point inwards", () => {
    expect(checkRecipeUrl("http://[::]/").ok).toBe(false);
    expect(checkRecipeUrl("http://[fd00::1]/").ok).toBe(false);
    expect(checkRecipeUrl("http://[fe80::1]/").ok).toBe(false);
  });

  it("sees through the encodings a URL parser normalises", () => {
    // Decimal, hex, octal and short-form all resolve to 127.0.0.1.
    for (const host of ["2130706433", "0x7f000001", "0177.0.0.1", "127.1"]) {
      expect(checkRecipeUrl(`http://${host}/`).ok).toBe(false);
    }
  });

  it("is not fooled by a public host in the userinfo", () => {
    expect(checkRecipeUrl("http://example.com@127.0.0.1/").ok).toBe(false);
  });

  it("allows ordinary public IPv6", () => {
    expect(checkRecipeUrl("http://[2606:4700::1111]/").ok).toBe(true);
  });

  it("allows a public address that merely looks similar", () => {
    expect(checkRecipeUrl("https://172.32.0.1/recipe").ok).toBe(true);
    expect(checkRecipeUrl("https://11.0.0.1/recipe").ok).toBe(true);
  });
});

describe("extractJsonLd", () => {
  it("reads a single block", () => {
    expect(extractJsonLd(page(RECIPE))).toHaveLength(1);
  });

  it("flattens an array and a @graph wrapper", () => {
    expect(extractJsonLd(page([RECIPE, { "@type": "WebSite" }]))).toHaveLength(2);
    expect(extractJsonLd(page({ "@graph": [RECIPE, { "@type": "Person" }] }))).toHaveLength(2);
  });

  it("keeps the good blocks when one is malformed", () => {
    const html = `<script type="application/ld+json">{ oops </script>${page(RECIPE)}`;
    expect(extractJsonLd(html)).toHaveLength(1);
  });

  it("returns nothing for a page with no structured data", () => {
    expect(extractJsonLd("<html><body>A lovely recipe blog post</body></html>")).toEqual([]);
  });
});

describe("parseIsoDuration", () => {
  it("reads hours and minutes", () => {
    expect(parseIsoDuration("PT1H15M")).toBe(75);
    expect(parseIsoDuration("PT35M")).toBe(35);
    expect(parseIsoDuration("PT2H")).toBe(120);
  });

  it("counts days, so an overnight prove is not read as minutes", () => {
    expect(parseIsoDuration("P1DT2H")).toBe(1560);
  });

  it("ignores seconds rather than rounding a recipe to zero", () => {
    expect(parseIsoDuration("PT30S")).toBeNull();
  });

  it("returns null for anything it cannot read", () => {
    expect(parseIsoDuration("35 minutes")).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
    expect(parseIsoDuration(35)).toBeNull();
  });
});

describe("parseRecipeFromHtml", () => {
  it("reads name, time, yield and ingredients", () => {
    const result = parseRecipeFromHtml(page(RECIPE), "https://example.com/x");
    expect(result).toEqual({
      ok: true,
      recipe: {
        name: "Sheet-Pan Salmon",
        timeMinutes: 35,
        servings: "4 servings",
        ingredients: ["2 salmon fillets", "1 lemon", "Olive oil"],
        sourceUrl: "https://example.com/x",
      },
    });
  });

  it("finds the recipe among unrelated structured data", () => {
    const result = parseRecipeFromHtml(
      page([{ "@type": "Organization", name: "A Blog" }, RECIPE]),
      "https://example.com/x",
    );
    expect(result.ok && result.recipe.name).toBe("Sheet-Pan Salmon");
  });

  it("accepts @type given as an array", () => {
    const result = parseRecipeFromHtml(
      page({ ...RECIPE, "@type": ["Recipe", "NewsArticle"] }),
      "https://example.com/x",
    );
    expect(result.ok).toBe(true);
  });

  it("falls back through totalTime, cookTime, prepTime", () => {
    const noTotal = parseRecipeFromHtml(
      page({ ...RECIPE, totalTime: undefined, cookTime: "PT20M" }),
      "u",
    );
    expect(noTotal.ok && noTotal.recipe.timeMinutes).toBe(20);
  });

  it("tidies ingredient text and drops duplicates", () => {
    const result = parseRecipeFromHtml(
      page({ ...RECIPE, recipeIngredient: ["1  lemon", "1 lemon", "  Olive oil  "] }),
      "u",
    );
    expect(result.ok && result.recipe.ingredients).toEqual(["1 lemon", "Olive oil"]);
  });

  it("reads ingredients given as objects", () => {
    const result = parseRecipeFromHtml(
      page({ ...RECIPE, recipeIngredient: [{ name: "2 eggs" }, "Milk"] }),
      "u",
    );
    expect(result.ok && result.recipe.ingredients).toEqual(["2 eggs", "Milk"]);
  });

  it("fails rather than guessing when the page has no structured recipe", () => {
    // An approximate read of the prose gives a list that looks complete and
    // isn't, and the missing ingredient is discovered at the stove.
    const result = parseRecipeFromHtml("<html><body>Grandma's stew</body></html>", "u");
    expect(result.ok).toBe(false);
  });

  it("fails when a recipe has a name but no ingredients", () => {
    const result = parseRecipeFromHtml(
      page({ "@type": "Recipe", name: "Mystery Stew" }),
      "u",
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("Mystery Stew");
  });
});

describe("recipeYield given more than one way", () => {
  it("keeps the most informative phrase rather than joining them", () => {
    // Caldo Verde publishes ["6", "6 (2 cups each)"]; joining produced the
    // nonsense "6, 6 (2 cups each)" on the live recipe.
    const html = page({
      "@type": "Recipe",
      name: "Caldo Verde",
      recipeYield: ["6", "6 (2 cups each)"],
      recipeIngredient: ["1/4 cup olive oil"],
    });
    const result = parseRecipeFromHtml(html, "https://example.com/caldo");
    expect(result.ok && result.recipe.servings).toBe("6 (2 cups each)");
  });

  it("still reads a plain string yield", () => {
    const html = page({
      "@type": "Recipe",
      name: "Soup",
      recipeYield: "4 servings",
      recipeIngredient: ["water"],
    });
    const result = parseRecipeFromHtml(html, "https://example.com/soup");
    expect(result.ok && result.recipe.servings).toBe("4 servings");
  });
});
