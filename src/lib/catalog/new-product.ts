import { normalizeQuery } from "@/lib/catalog-search";
import { isCatalogCategory, isCatalogSubcategory } from "./categories";

/**
 * Turning an unmatched receipt line into a catalogue product.
 *
 * The catalogue is shared reference data, so this is deliberately narrow: a
 * person names a product they actually bought, and the raw receipt text is
 * kept as a search alias so the same abbreviation resolves itself next time.
 * Nothing here invents a brand, a size or a price — the receipt supplies the
 * price, and the person supplies the name.
 */

export type NewCatalogProductInput = {
  displayName: string;
  category: string;
  subcategory?: string | null;
  brand?: string | null;
  /** The receipt text this product was created from, e.g. "LAYS OLD FSH BBQ". */
  rawDescription?: string | null;
};

export type NewCatalogProduct = {
  id: string;
  display_name: string;
  normalized_name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  search_aliases: string[];
  source: string;
  source_notes: string | null;
  image_ready: boolean;
  manually_edited: boolean;
};

/** Provenance marker. The RLS insert policy requires exactly this value, so a
 *  user-added product can never masquerade as part of the seeded library. */
export const HOUSEHOLD_PRODUCT_SOURCE = "household";

export const MAX_DISPLAY_NAME = 80;

/** kebab-case slug, matching the ids the seeded library already uses. */
export function slugifyProductId(displayName: string): string {
  return normalizeQuery(displayName).replace(/\s+/g, "-").slice(0, 60);
}

/** Appends -2, -3, … only when the plain slug is taken. */
export function uniqueProductId(displayName: string, taken: Iterable<string>): string {
  const base = slugifyProductId(displayName);
  const existing = new Set(taken);
  if (!existing.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export type NewProductCheck = { ok: true } | { ok: false; message: string };

export function validateNewProduct(input: NewCatalogProductInput): NewProductCheck {
  const name = input.displayName.trim();
  if (name.length < 2) return { ok: false, message: "Give the product a name." };
  if (name.length > MAX_DISPLAY_NAME) {
    return { ok: false, message: `Keep the name under ${MAX_DISPLAY_NAME} characters.` };
  }
  if (slugifyProductId(name).length === 0) {
    return { ok: false, message: "That name needs at least one letter or number." };
  }
  if (!isCatalogCategory(input.category)) {
    return { ok: false, message: "Pick a category for it." };
  }
  // (category, subcategory) is a foreign key, so an unknown pair would fail as
  // a raw database error rather than something a person can act on.
  const subcategory = input.subcategory?.trim();
  if (subcategory && !isCatalogSubcategory(input.category, subcategory)) {
    return { ok: false, message: `"${subcategory}" isn't an aisle under ${input.category}.` };
  }
  return { ok: true };
}

/**
 * Builds the row. The raw receipt text becomes a search alias, which is what
 * makes the next receipt match without asking again.
 */
export function buildNewCatalogProduct(
  input: NewCatalogProductInput,
  takenIds: Iterable<string> = [],
): NewCatalogProduct {
  const displayName = input.displayName.trim();
  const brand = input.brand?.trim() || null;
  const raw = input.rawDescription?.trim() || null;

  const aliases = new Set<string>();
  if (raw) {
    const normalizedRaw = normalizeQuery(raw);
    if (normalizedRaw && normalizedRaw !== normalizeQuery(displayName)) aliases.add(normalizedRaw);
  }

  return {
    id: uniqueProductId(displayName, takenIds),
    display_name: displayName,
    normalized_name: normalizeQuery(displayName),
    brand,
    category: input.category,
    subcategory: input.subcategory?.trim() || null,
    search_aliases: [...aliases],
    source: HOUSEHOLD_PRODUCT_SOURCE,
    source_notes: raw ? `Added from receipt text "${raw}"` : "Added by hand",
    image_ready: false,
    manually_edited: true,
  };
}
