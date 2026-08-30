import { CATALOG_CATEGORIES } from "@/lib/catalog/categories";
import type { PantryProduct } from "@/lib/data/pantry";

/**
 * Household areas for a Pantry Check walk-through, in the order somebody
 * actually walks them. Kitchen areas come first because they are reviewed far
 * more often than the laundry cupboard (§6).
 */
export const PANTRY_AREAS = [
  "Kitchen Pantry",
  "Fridge",
  "Freezer",
  "Bathroom",
  "Laundry",
  "Cleaning",
  "Household",
  "Unassigned",
] as const;

export type PantryArea = (typeof PANTRY_AREAS)[number];

/**
 * Maps a stored stock_location to a review area. Locations the household set
 * that don't map to a known area keep their own name rather than being forced
 * into a bucket; anything with no location at all stays honestly Unassigned
 * (§5 — never fabricate a location).
 */
const LOCATION_TO_AREA: Record<string, PantryArea> = {
  Pantry: "Kitchen Pantry",
  Counter: "Kitchen Pantry",
  "Kitchen Drawer": "Kitchen Pantry",
  Fridge: "Fridge",
  Freezer: "Freezer",
  Bathroom: "Bathroom",
  "Laundry Room": "Laundry",
  "Under Sink": "Cleaning",
  "Storage Closet": "Household",
};

export function areaForLocation(location: string | null): string {
  if (!location) return "Unassigned";
  return LOCATION_TO_AREA[location] ?? location;
}

/**
 * Kitchen-side categories, in the order §6 asks them to be worked through.
 * Derived from the canonical taxonomy so a newly added kitchen category joins
 * the walk automatically instead of falling to the end unranked.
 */
const KITCHEN_CATEGORY_ORDER = CATALOG_CATEGORIES.filter((c) => c.kitchenOrder !== null)
  .sort((a, b) => a.kitchenOrder! - b.kitchenOrder!)
  .map((c) => c.name);

function categoryRank(category: string | null): number {
  if (!category) return KITCHEN_CATEGORY_ORDER.length;
  const index = KITCHEN_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? KITCHEN_CATEGORY_ORDER.length : index;
}

export type AreaGroup = { area: string; items: PantryProduct[] };

/** Groups regular buys into review areas, kitchen areas first. */
export function groupByArea(items: PantryProduct[]): AreaGroup[] {
  const byArea = new Map<string, PantryProduct[]>();
  for (const item of items) {
    const area = areaForLocation(item.stock_location);
    const bucket = byArea.get(area);
    if (bucket) bucket.push(item);
    else byArea.set(area, [item]);
  }

  const rank = (area: string) => {
    const index = (PANTRY_AREAS as readonly string[]).indexOf(area);
    // Unknown, household-authored locations sort after the known areas but
    // before Unassigned, which always comes last.
    return index === -1 ? PANTRY_AREAS.length - 1.5 : index;
  };

  return [...byArea.entries()]
    .map(([area, group]) => ({
      area,
      items: group.sort((a, b) => {
        const byCategory = categoryRank(a.category) - categoryRank(b.category);
        if (byCategory !== 0) return byCategory;
        return a.title.localeCompare(b.title);
      }),
    }))
    .sort((a, b) => rank(a.area) - rank(b.area));
}
