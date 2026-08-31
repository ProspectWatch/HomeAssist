import { CATALOG_CATEGORIES } from "@/lib/catalog/categories";

/**
 * Regular Buys — the household's baseline of what it actually buys.
 *
 * A regular buy points at a generic catalogue CONCEPT ("Potato Chips"), and
 * the brand preference lives on the tag rather than on the concept. That
 * separation is what makes deal matching work later: a flyer or a receipt
 * matches the concept, and this says whether the household will accept the
 * brand on offer.
 */

export type BrandRigidity = "EXACT_ONLY" | "PREFERRED" | "FLEXIBLE";

export const BRAND_RIGIDITY_OPTIONS: { value: BrandRigidity; label: string; hint: string }[] = [
  { value: "FLEXIBLE", label: "Any brand", hint: "Whatever's cheapest is fine." },
  { value: "PREFERRED", label: "Prefer this brand", hint: "We'd rather have it, but we'll switch to save." },
  { value: "EXACT_ONLY", label: "Only this brand", hint: "Don't suggest anything else." },
];

export function isBrandRigidity(value: string): value is BrandRigidity {
  return BRAND_RIGIDITY_OPTIONS.some((o) => o.value === value);
}

export type RegularBuy = {
  catalogProductId: string;
  displayName: string;
  category: string;
  subcategory: string | null;
  imageUrl: string | null;
  imageReady: boolean;
  preferredBrand: string | null;
  brandRigidity: BrandRigidity;
  /** Starred in Pantry. Sorts to the top of its category. */
  isFavourite: boolean;
  /**
   * The household's own SKU row, when this buy came from `products` rather
   * than the preference layer. Untagging one has to update the row it
   * actually lives on.
   */
  productId: string | null;
};

/**
 * One line a person can read at a glance. Deliberately says nothing when
 * there's no brand preference — "Any brand" is the default, and repeating it
 * on every row is noise.
 */
export function describeBrandPreference(buy: Pick<RegularBuy, "preferredBrand" | "brandRigidity">): string | null {
  if (!buy.preferredBrand) return buy.brandRigidity === "EXACT_ONLY" ? null : null;
  switch (buy.brandRigidity) {
    case "EXACT_ONLY":
      return `${buy.preferredBrand} only`;
    case "PREFERRED":
      return `${buy.preferredBrand} preferred`;
    default:
      return `Usually ${buy.preferredBrand}`;
  }
}

/** Whether a deal on `brand` is worth showing for this regular buy. */
export function acceptsBrand(
  buy: Pick<RegularBuy, "preferredBrand" | "brandRigidity">,
  brand: string | null,
): boolean {
  if (buy.brandRigidity === "FLEXIBLE" || !buy.preferredBrand) return true;
  if (!brand) return buy.brandRigidity !== "EXACT_ONLY";
  const same = brand.trim().toLowerCase() === buy.preferredBrand.trim().toLowerCase();
  return buy.brandRigidity === "EXACT_ONLY" ? same : true;
}

const CATEGORY_ORDER = new Map(CATALOG_CATEGORIES.map((c, i) => [c.name, i]));

export type RegularBuyGroup = { category: string; items: RegularBuy[] };

/** Groups for display, in the catalogue's own category order. */
export function groupRegularBuys(buys: RegularBuy[]): RegularBuyGroup[] {
  const byCategory = new Map<string, RegularBuy[]>();
  for (const buy of buys) {
    const list = byCategory.get(buy.category);
    if (list) list.push(buy);
    else byCategory.set(buy.category, [buy]);
  }
  return [...byCategory.entries()]
    .map(([category, items]) => ({
      category,
      // Favourites first inside each category: the star is the household
      // saying "this one matters", and burying it alphabetically ignores that.
      items: items.sort(
        (a, b) =>
          Number(b.isFavourite) - Number(a.isFavourite) ||
          a.displayName.localeCompare(b.displayName),
      ),
    }))
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.get(a.category) ?? Number.MAX_SAFE_INTEGER;
      const bi = CATEGORY_ORDER.get(b.category) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi || a.category.localeCompare(b.category);
    });
}
