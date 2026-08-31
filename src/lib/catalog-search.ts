import type { CatalogProduct } from "@/lib/data/catalog";

// Mirrors product_search_normalize() in 0004_product_catalog.sql: lowercase,
// punctuation stripped to spaces, so "Earth's Own" and "earths own" match,
// and plural/singular differences ("egg"/"eggs") resolve as plain substrings.
export function normalizeQuery(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’]/g, "") // drop apostrophes entirely: "Earth's" -> "earths", not "earth s"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Deliberately excludes category/subcategory: including them let a query
// like "eggs" (a substring of the category "Dairy & Eggs") match every
// dairy product, not just eggs. Category-driven discovery is Browse's job
// (step 5) — this stays a product-identity search (name/brand/aliases).
function haystack(product: CatalogProduct): string {
  return normalizeQuery([product.display_name, product.brand ?? "", ...product.search_aliases].join(" "));
}

/**
 * Instant client-side ranking over the cached catalogue (step 3/11): no
 * network round-trip per keystroke.
 *
 * Two things this has to do that a plain substring filter does not.
 *
 * Multi-word queries. "heinz ketchup" is how a person names a product, and
 * scoring the whole string as one token means it matches nothing at all — the
 * words are never adjacent in that order in any record. Every word must match
 * something, and the score is the weakest word's, so a query is only as good
 * as its worst-matching term.
 *
 * The household's own brands first. The shared catalogue is generic by design
 * and only 12 of its 1,663 products carry a brand, so a brand search against
 * it is hopeless; the brands this family actually buys live on their own
 * products. Those are folded into the same index and boosted, which is the
 * difference between "ketchup" returning their Heinz and returning a wall of
 * brands they have no interest in.
 *
 * The tiers matter more than they look at catalogue scale. With ~1,700
 * products a one-word query like "chips" matches two dozen names equally on a
 * plain word-prefix test, and the canonical concept ("Potato Chips") loses to
 * whatever sorts first alphabetically ("All Dressed Chips"). So an exact name
 * or alias wins outright, a head-noun match ("… Chips") outranks a match
 * buried mid-name, and ties break toward the shorter, more general name —
 * which is the one a person typing a bare category term is reaching for.
 */
const SCORE = {
  exactName: 120,
  namePrefix: 100,
  /** An alias the household or catalogue records verbatim, e.g. "pop" -> Cola. */
  exactAlias: 95,
  /** The query is the head noun: "chips" in "Potato Chips". */
  headNoun: 90,
  nameWordPrefix: 80,
  aliasWordPrefix: 60,
  substring: 40,
} as const;

/** Lifts a product the household actually buys above the generic equivalent. */
const HOUSEHOLD_BOOST = 200;

function scoreTerm(product: CatalogProduct, query: string): number {
  const name = normalizeQuery(product.display_name);
  if (name === query) return SCORE.exactName;

  const aliases = product.search_aliases.map(normalizeQuery);
  if (aliases.includes(query)) return SCORE.exactAlias;
  if (name.startsWith(query)) return SCORE.namePrefix;
  if (name === query || name.endsWith(` ${query}`)) return SCORE.headNoun;
  if (name.split(" ").some((word) => word.startsWith(query))) return SCORE.nameWordPrefix;

  const hay = haystack(product);
  if (hay.split(" ").some((word) => word.startsWith(query))) return SCORE.aliasWordPrefix;
  if (hay.includes(query)) return SCORE.substring;
  return 0;
}

/**
 * Scores a whole query, which may be several words.
 *
 * Every word has to match something — "heinz ketchup" must not return every
 * ketchup — and the result is the weakest word's score, so one strong term
 * cannot carry a query whose other term barely matched.
 */
export function scoreProduct(product: CatalogProduct, query: string): number {
  const terms = query.split(" ").filter(Boolean);
  if (terms.length === 0) return 0;

  let weakest = Infinity;
  for (const term of terms) {
    const score = scoreTerm(product, term);
    if (score === 0) return 0;
    weakest = Math.min(weakest, score);
  }
  // A multi-word query that matches every term is a more specific hit than a
  // single-word one of the same strength, so it edges ahead.
  return weakest + (terms.length - 1) * 5;
}

export function searchCatalog(products: CatalogProduct[], rawQuery: string, limit = 20): CatalogProduct[] {
  const query = normalizeQuery(rawQuery);
  if (!query) return [];

  const scored: { product: CatalogProduct; score: number }[] = [];
  for (const product of products) {
    const base = scoreProduct(product, query);
    if (base > 0) {
      scored.push({ product, score: base + (product.isHouseholdProduct ? HOUSEHOLD_BOOST : 0) });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Fewer words, then shorter: "Potato Chips" ahead of "All Dressed Chips".
    const aWords = a.product.display_name.split(/\s+/).length;
    const bWords = b.product.display_name.split(/\s+/).length;
    if (aWords !== bWords) return aWords - bWords;
    if (a.product.display_name.length !== b.product.display_name.length) {
      return a.product.display_name.length - b.product.display_name.length;
    }
    return a.product.display_name.localeCompare(b.product.display_name);
  });

  return scored.slice(0, limit).map((s) => s.product);
}
