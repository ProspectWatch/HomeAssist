/**
 * The canonical catalogue taxonomy — the single source of truth in code for
 * what product_categories and product_subcategories hold in the database.
 *
 * Those are real FK-enforced tables: catalog_products.category references
 * product_categories(name), and (category, subcategory) references
 * product_subcategories. So a category cannot simply be typed in — it has to
 * exist here AND be seeded, which is why chips and candy came back UNMATCHED
 * from a real Fortinos receipt with nowhere to file them.
 *
 * Three parts of the app used to carry their own hardcoded copy of the
 * category list — the grocery-list grouping, the pantry walk order, and the
 * product-image icon fallbacks — and a category missing from any one of them
 * degraded silently (unsorted, unranked, generic icon). One list, three
 * consumers, kept in step with migration 0017.
 */

export type CatalogCategory = {
  /** Matches product_categories.name exactly. */
  name: string;
  /** Section of the grocery list this files into (grocery_items.category is
   *  an older, flatter grouping fixed by a database check constraint). */
  groceryCategory: "Meat" | "Dairy" | "Produce" | "Pantry" | "Frozen" | "Household" | "Other";
  /** Mirrors product_categories.sort_order. */
  sortOrder: number;
  /** Order for the kitchen-side pantry walk (§6). Null for aisles that aren't
   *  stocked in the kitchen and shouldn't appear in that sequence. */
  kitchenOrder: number | null;
  /** Matches product_subcategories for this category. Never a closed set. */
  subcategories: string[];
};

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  {
    name: "Produce",
    groceryCategory: "Produce",
    sortOrder: 0,
    kitchenOrder: 0,
    subcategories: ["Leafy Greens", "Vegetables", "Fruit"],
  },
  {
    name: "Meat & Seafood",
    groceryCategory: "Meat",
    sortOrder: 1,
    kitchenOrder: 1,
    subcategories: ["Beef", "Poultry", "Pork", "Prepared Meat", "Seafood"],
  },
  {
    name: "Dairy & Eggs",
    groceryCategory: "Dairy",
    sortOrder: 2,
    kitchenOrder: 2,
    subcategories: ["Milk", "Eggs", "Cheese", "Dairy"],
  },
  {
    name: "Deli & Prepared",
    groceryCategory: "Other",
    sortOrder: 5,
    kitchenOrder: 3,
    subcategories: ["Deli", "Prepared Meals"],
  },
  {
    // Added in 0017.
    name: "Bakery",
    groceryCategory: "Pantry",
    sortOrder: 8,
    kitchenOrder: 4,
    subcategories: ["Bread", "Buns & Rolls", "Sweet Baked", "Tortillas & Wraps"],
  },
  {
    name: "Pantry",
    groceryCategory: "Pantry",
    sortOrder: 3,
    kitchenOrder: 5,
    subcategories: ["Bread", "Breakfast", "Baking", "Pasta & Rice", "Sauces", "Condiments", "Oils", "Spices", "Meal Kits", "Soup & Broth", "Snacks"],
  },
  {
    // Added in 0017.
    name: "Snacks",
    groceryCategory: "Pantry",
    sortOrder: 9,
    kitchenOrder: 6,
    subcategories: ["Chips", "Crackers", "Popcorn & Puffs", "Nuts & Seeds", "Bars & Granola"],
  },
  {
    // Added in 0017.
    name: "Confectionery",
    groceryCategory: "Pantry",
    sortOrder: 10,
    kitchenOrder: 7,
    subcategories: ["Candy", "Chocolate", "Fruit Snacks", "Gum & Mints"],
  },
  {
    name: "Frozen",
    groceryCategory: "Frozen",
    sortOrder: 4,
    kitchenOrder: 8,
    subcategories: ["Frozen Meals", "Frozen Meat", "Frozen Sides", "Frozen Vegetables", "Frozen Dessert"],
  },
  {
    name: "Drinks",
    groceryCategory: "Other",
    sortOrder: 6,
    kitchenOrder: 9,
    subcategories: ["Juice", "Kids Drinks", "Tea", "Water", "Coffee", "Soft Drinks", "Sports & Energy"],
  },
  {
    name: "Household",
    groceryCategory: "Household",
    sortOrder: 7,
    kitchenOrder: null,
    subcategories: ["Laundry", "Dishwashing", "Cleaning", "Paper", "Waste", "Storage", "Personal Care", "Pet", "Home Supplies"],
  },
  {
    // Added in 0017.
    name: "Health & Beauty",
    groceryCategory: "Household",
    sortOrder: 11,
    kitchenOrder: null,
    subcategories: ["Personal Care", "Hair", "Oral Care", "Medicine Cabinet", "Skin Care"],
  },
  {
    // Added in 0017.
    name: "Baby & Kids",
    groceryCategory: "Other",
    sortOrder: 12,
    kitchenOrder: null,
    subcategories: ["Diapers & Wipes", "Baby Food", "Baby Care"],
  },
  {
    // Added in 0017.
    name: "Pet",
    groceryCategory: "Other",
    sortOrder: 13,
    kitchenOrder: null,
    subcategories: ["Dog", "Cat", "Pet Supplies"],
  },
];

export const CATALOG_CATEGORY_NAMES: string[] = CATALOG_CATEGORIES.map((c) => c.name);

export function findCatalogCategory(name: string | null | undefined): CatalogCategory | null {
  if (!name) return null;
  return CATALOG_CATEGORIES.find((c) => c.name === name) ?? null;
}

export function isCatalogCategory(name: string): boolean {
  return findCatalogCategory(name) !== null;
}

export function subcategoriesFor(name: string): string[] {
  return findCatalogCategory(name)?.subcategories ?? [];
}

/** A (category, subcategory) pair the FK will accept. */
export function isCatalogSubcategory(category: string, subcategory: string): boolean {
  return subcategoriesFor(category).includes(subcategory);
}
