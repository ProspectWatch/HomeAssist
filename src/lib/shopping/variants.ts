/**
 * Which flavours a household actually buys, derived from the products it owns.
 *
 * Deal matching works on brand — a Doritos offer covers every bag — but a
 * shopping list has to name one. Rather than invent a flavour catalogue, this
 * reads the household's own products: 69 photographed items already carry
 * "Doritos Nacho Cheese Tortilla Chips", "Doritos Ketchup", "Doritos Sweet
 * Chili Heat". Those three are the choices, because those are the three this
 * house eats.
 *
 * Nothing here guesses. A brand with one product offers no choice, and an item
 * that matches no brand offers none either — the list line just stays as it is.
 */

export type HouseholdProductRow = {
  brand: string | null;
  title: string;
  catalogProductId: string | null;
};

export type BrandVariants = {
  brand: string;
  /** The flavour names, in the order they read best: alphabetical. */
  variants: string[];
  /** Catalogue ids of every product under this brand, for matching by id. */
  catalogProductIds: string[];
};

/**
 * "Doritos Nacho Cheese Tortilla Chips" under brand "Doritos" is
 * "Nacho Cheese Tortilla Chips".
 *
 * A title that is only the brand ("Oreo") has no flavour in it, so it yields
 * null rather than an empty string that would render as a blank chip.
 */
export function variantLabel(brand: string, title: string): string | null {
  const b = brand.trim();
  const t = title.trim();
  if (!b) return t || null;
  const lower = t.toLowerCase();
  const brandLower = b.toLowerCase();
  let rest = t;
  if (lower.startsWith(brandLower)) rest = t.slice(b.length);
  else if (lower.endsWith(brandLower)) rest = t.slice(0, t.length - b.length);
  else return t || null;
  // Leading separators are an artefact of the split, not part of the name.
  rest = rest.replace(/^[\s\-–—:,·]+/, "").replace(/[\s\-–—:,·]+$/, "");
  return rest.length > 0 ? rest : null;
}

/** Brands the household owns more than one flavour of. */
export function buildBrandVariants(products: HouseholdProductRow[]): BrandVariants[] {
  const byBrand = new Map<string, { brand: string; variants: Set<string>; ids: Set<string> }>();
  for (const product of products) {
    const brand = product.brand?.trim();
    if (!brand) continue;
    const key = brand.toLowerCase();
    const entry = byBrand.get(key) ?? { brand, variants: new Set<string>(), ids: new Set<string>() };
    const label = variantLabel(brand, product.title);
    if (label) entry.variants.add(label);
    if (product.catalogProductId) entry.ids.add(product.catalogProductId);
    byBrand.set(key, entry);
  }
  return [...byBrand.values()]
    .filter((e) => e.variants.size > 1)
    .map((e) => ({
      brand: e.brand,
      variants: [...e.variants].sort((a, b) => a.localeCompare(b)),
      catalogProductIds: [...e.ids],
    }));
}

/** Whole-word brand mention, so "Dare" doesn't match "Daredevil". */
function mentionsBrand(text: string, brand: string): boolean {
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

/**
 * The flavour choice for one list line, or null when there is none to offer.
 *
 * Matching by catalogue id first: a line added from a deal carries the id of
 * the exact product, which is a fact. Falling back to the brand appearing in
 * the line's own text covers a hand-typed "Doritos", which is a reasonable
 * reading and is why the picker is offered rather than applied.
 */
export function variantsForListItem(
  item: { name: string; catalogProductId: string | null },
  brands: BrandVariants[],
): BrandVariants | null {
  if (item.catalogProductId) {
    const byId = brands.find((b) => b.catalogProductIds.includes(item.catalogProductId!));
    if (byId) return byId;
  }
  // Longest brand first, so "Kraft Singles" wins over "Kraft".
  const byName = [...brands]
    .sort((a, b) => b.brand.length - a.brand.length)
    .find((b) => mentionsBrand(item.name, b.brand));
  return byName ?? null;
}
