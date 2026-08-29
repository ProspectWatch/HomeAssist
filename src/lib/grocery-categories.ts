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
// richer taxonomy (step 5). This maps one onto the other so picking a
// catalogue product still files into the right grocery-list section.
const CATALOG_CATEGORY_TO_GROCERY_CATEGORY: Record<string, (typeof CATEGORY_ORDER)[number]> = {
  Produce: "Produce",
  "Meat & Seafood": "Meat",
  "Dairy & Eggs": "Dairy",
  Pantry: "Pantry",
  Frozen: "Frozen",
  Household: "Household",
  "Deli & Prepared": "Other",
  Drinks: "Other",
};

export function mapCatalogCategoryToGroceryCategory(catalogCategory: string): (typeof CATEGORY_ORDER)[number] {
  return CATALOG_CATEGORY_TO_GROCERY_CATEGORY[catalogCategory] ?? "Other";
}
