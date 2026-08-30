import { CATALOG_CATEGORIES } from "@/lib/catalog/categories";

export const CATEGORY_ORDER = ["Meat", "Dairy", "Produce", "Pantry", "Frozen", "Household", "Other"] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  Meat: "MEAT & SEAFOOD",
  Dairy: "DAIRY & EGGS",
  Produce: "PRODUCE",
  Pantry: "PANTRY",
  Frozen: "FROZEN",
  Household: "HOUSEHOLD",
  Other: "OTHER",
};

// grocery_items.category is this app's older, flatter grouping (a fixed
// db check constraint); catalog_products.category is the product library's
// richer taxonomy (step 5). Derived from the canonical taxonomy rather than
// re-listed here, so a category added there can never go missing from the
// grocery list and silently land in "Other".
const CATALOG_CATEGORY_TO_GROCERY_CATEGORY: Record<string, (typeof CATEGORY_ORDER)[number]> =
  Object.fromEntries(CATALOG_CATEGORIES.map((c) => [c.name, c.groceryCategory]));

export function mapCatalogCategoryToGroceryCategory(catalogCategory: string): (typeof CATEGORY_ORDER)[number] {
  return CATALOG_CATEGORY_TO_GROCERY_CATEGORY[catalogCategory] ?? "Other";
}
