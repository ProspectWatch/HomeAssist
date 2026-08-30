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
 * network round-trip per keystroke. Prefix matches on the name rank
 * highest, then any word starting with the query, then a plain substring.
 */
export function searchCatalog(products: CatalogProduct[], rawQuery: string, limit = 20): CatalogProduct[] {
  const query = normalizeQuery(rawQuery);
  if (!query) return [];

  const scored: { product: CatalogProduct; score: number }[] = [];
  for (const product of products) {
    const name = normalizeQuery(product.display_name);
    const hay = haystack(product);
    let score = 0;
    if (name.startsWith(query)) score = 100;
    else if (name.split(" ").some((word) => word.startsWith(query))) score = 80;
    else if (hay.split(" ").some((word) => word.startsWith(query))) score = 60;
    else if (hay.includes(query)) score = 40;
    if (score > 0) scored.push({ product, score });
  }

  scored.sort((a, b) => b.score - a.score || a.product.display_name.localeCompare(b.product.display_name));
  return scored.slice(0, limit).map((s) => s.product);
}
