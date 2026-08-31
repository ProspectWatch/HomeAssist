/**
 * Reading a recipe's ingredient line against what the kitchen already has.
 *
 * An imported line is prose: "1/4 cup extra-virgin olive oil", "2 garlic
 * cloves (sliced; don't be afraid to go for a third)". A pantry name is short:
 * "Olive Oil", "Garlic". So the match runs in that direction — look for the
 * pantry's own name inside the recipe's line — because the short, clean side
 * is the one worth trusting as a search term.
 *
 * The point of restraint here: an ingredient this cannot place is reported as
 * not tracked, never as out of stock. "We have none" and "nobody has ever told
 * the app about this" look the same on a shopping list and are not the same
 * thing, and the second dressed up as the first sends someone to the shop for
 * salt they already own.
 */

import type { InventoryStatus } from "@/lib/data/inventory";

export type PantryEntry = {
  /** What the household calls it, e.g. "Olive Oil". */
  title: string;
  catalogProductId: string | null;
  status: InventoryStatus;
};

export type IngredientMatch = {
  /** The pantry item this line was read as, or null when none was found. */
  entry: PantryEntry | null;
  /** How it was matched — shown to the person so the reading is inspectable. */
  how: "catalogue" | "name" | "none";
};

/**
 * Numeric-entity and named-entity decoding, because imported ingredient text
 * arrives with them intact — a real line in this household's recipes reads
 * "Portugal&#39;s yellow potatoes".
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Ampersand last, so "&amp;#39;" doesn't become an apostrophe.
    .replace(/&amp;/g, "&");
}

/** Lowercased, entity-free, with curly quotes and punctuation flattened. */
export function normalise(text: string): string {
  return decodeEntities(text)
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

/**
 * Whole-phrase, plural-tolerant containment: "potato" matches "6 medium
 * potatoes", and "salt" does not match "salted butter".
 */
export function mentions(haystack: string, needle: string): boolean {
  const words = normalise(needle).split(" ").filter(Boolean);
  if (words.length === 0) return false;
  const pattern = words
    .map((w) => `${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:e?s)?`)
    .join("\\s+");
  return new RegExp(`(?:^|\\s)${pattern}(?:$|\\s)`).test(normalise(haystack));
}

/**
 * Drops the parenthetical asides recipe writers hang off an ingredient.
 *
 * Not cosmetic. "3 1/4 pounds small clams (such as cockles, manila, butter, or
 * littlenecks)" matched the pantry's Butter, and "8 cups cold water (or half
 * homemade chicken stock or canned chicken broth)" matched Chicken Broth —
 * both from words describing something other than the ingredient. The head of
 * the line is what the line is about; the aside is about everything else.
 *
 * The whole line is kept when stripping leaves nothing, so a line written
 * entirely inside brackets still gets a reading.
 */
export function stripParentheticals(text: string): string {
  let out = "";
  let depth = 0;
  for (const char of text) {
    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    else if (depth === 0) out += char;
  }
  return out.trim().length > 0 ? out : text;
}

/**
 * Which pantry item, if any, a recipe line is about.
 *
 * The catalogue id wins outright: somebody linked that ingredient to that
 * product by hand, which is a fact rather than a reading. Failing that, the
 * longest pantry name mentioned in the line wins, so "Yukon Gold Potatoes"
 * beats "Potatoes" on a line that says both.
 */
export function matchIngredient(
  ingredient: { name: string; catalogProductId: string | null },
  pantry: PantryEntry[],
): IngredientMatch {
  if (ingredient.catalogProductId) {
    const byId = pantry.find((p) => p.catalogProductId === ingredient.catalogProductId);
    if (byId) return { entry: byId, how: "catalogue" };
  }

  const head = stripParentheticals(ingredient.name);
  let best: PantryEntry | null = null;
  let bestLength = 0;
  for (const entry of pantry) {
    const length = normalise(entry.title).length;
    if (length <= bestLength) continue;
    if (mentions(head, entry.title)) {
      best = entry;
      bestLength = length;
    }
  }
  return best ? { entry: best, how: "name" } : { entry: null, how: "none" };
}

/**
 * What the row should say. UNTRACKED is deliberately its own state and not
 * folded into OUT — see the note at the top of this file.
 */
export type IngredientStock = "IN_STOCK" | "LOW" | "OUT" | "UNKNOWN" | "UNTRACKED";

export function stockFor(match: IngredientMatch): IngredientStock {
  if (!match.entry) return "UNTRACKED";
  return match.entry.status;
}

/** Whether this is something to consider buying. */
export function needsBuying(stock: IngredientStock): boolean {
  return stock === "LOW" || stock === "OUT";
}
