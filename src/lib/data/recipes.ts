import { createClient } from "@/lib/supabase/server";
import { getRegularBuys } from "@/lib/data/pantry";
import { resolveNeedMatch, type ActiveListItem } from "@/lib/household/needs";
import {
  decodeEntities,
  matchIngredient,
  stockFor,
  type IngredientStock,
  type PantryEntry,
} from "@/lib/recipes/ingredient-match";

export type RecipeSummary = {
  id: string;
  name: string;
  time_minutes: number | null;
  servings: string | null;
  ingredient_count: number;
  store_count: number;
  /** This household's cover photo, if somebody took one. */
  cover_image_url: string | null;
};

export type RecipePhoto = {
  id: string;
  image_url: string;
  caption: string | null;
  is_cover: boolean;
};

/** An ingredient read against what the kitchen actually has. */
export type IngredientWithStock = RecipeIngredient & {
  /** Decoded for display — imported text arrives with HTML entities intact. */
  display_name: string;
  stock: IngredientStock;
  /** The pantry item it was read as, so the reading can be checked. */
  matched_title: string | null;
  matched_how: "catalogue" | "name" | "none";
  already_on_list: boolean;
};

export type RecipeKitchen = {
  recipe: RecipeDetail;
  cover: RecipePhoto | null;
  gallery: RecipePhoto[];
  ingredients: IngredientWithStock[];
};

export type RecipeIngredient = {
  id: string;
  name: string;
  qty: string | null;
  retailer: { name: string } | null;
  catalog_product_id: string | null;
};

export type RecipeDetail = {
  id: string;
  name: string;
  time_minutes: number | null;
  servings: string | null;
  meal_types: string[];
  notes: string | null;
  /**
   * True for the starter recipes every household can see. They are read-only:
   * the row belongs to everyone, so one household's edit would land on the
   * rest — which is what the RLS policies already enforce, said here so the
   * screen can stop offering an edit that would be refused.
   */
  is_shared: boolean;
  ingredients: RecipeIngredient[];
};

export async function getRecipes(): Promise<RecipeSummary[]> {
  try {
    const supabase = await createClient();
    // RLS scopes recipe_images to this household, so no household filter is
    // needed here and none is guessed at.
    const [{ data, error }, { data: covers }] = await Promise.all([
      supabase
        .from("recipes")
        .select("id, name, time_minutes, servings, recipe_ingredients(usual_retailer_id)")
        .order("name", { ascending: true }),
      supabase.from("recipe_images").select("recipe_id, image_url").eq("is_cover", true),
    ]);
    if (error || !data) return [];

    const coverByRecipe = new Map<string, string>();
    for (const row of (covers ?? []) as { recipe_id: string; image_url: string }[]) {
      coverByRecipe.set(row.recipe_id, row.image_url);
    }
    type Row = { id: string; name: string; time_minutes: number | null; servings: string | null; recipe_ingredients: { usual_retailer_id: string | null }[] };
    return (data as unknown as Row[]).map((r) => ({
      id: r.id,
      name: r.name,
      time_minutes: r.time_minutes,
      servings: r.servings,
      ingredient_count: r.recipe_ingredients.length,
      store_count: new Set(r.recipe_ingredients.map((i) => i.usual_retailer_id).filter(Boolean)).size,
      cover_image_url: coverByRecipe.get(r.id) ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getRecipe(id: string): Promise<RecipeDetail | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("recipes")
      .select(
        "id, name, time_minutes, servings, meal_types, notes, household_id, recipe_ingredients(id, name, qty, sort_order, catalog_product_id, retailer:retailers(name))",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    type Row = {
      id: string;
      name: string;
      time_minutes: number | null;
      servings: string | null;
      meal_types: string[] | null;
      notes: string | null;
      household_id: string | null;
      recipe_ingredients: {
        id: string;
        name: string;
        qty: string | null;
        sort_order: number;
        catalog_product_id: string | null;
        retailer: { name: string } | null;
      }[];
    };
    const r = data as unknown as Row;
    return {
      id: r.id,
      name: r.name,
      time_minutes: r.time_minutes,
      servings: r.servings,
      meal_types: r.meal_types ?? [],
      notes: r.notes,
      is_shared: r.household_id === null,
      ingredients: [...r.recipe_ingredients]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({ id: i.id, name: i.name, qty: i.qty, retailer: i.retailer, catalog_product_id: i.catalog_product_id })),
    };
  } catch {
    return null;
  }
}

/**
 * A recipe as the kitchen sees it: its photos, and every ingredient read
 * against what the household actually has.
 *
 * The reading is deliberately cautious. An ingredient it cannot place is
 * reported as untracked — not as out of stock — because those two look
 * identical on a shopping list and are not the same claim. Where it does place
 * one, it says how (a hand-linked catalogue product, or a pantry name found in
 * the line), so the person can see the reasoning and correct it.
 */
export async function getRecipeKitchen(
  id: string,
  householdId: string | null,
): Promise<RecipeKitchen | null> {
  const recipe = await getRecipe(id);
  if (!recipe) return null;

  if (!householdId) {
    return {
      recipe,
      cover: null,
      gallery: [],
      ingredients: recipe.ingredients.map((i) => ({
        ...i,
        display_name: decodeEntities(i.name),
        stock: "UNTRACKED" as const,
        matched_title: null,
        matched_how: "none" as const,
        already_on_list: false,
      })),
    };
  }

  const supabase = await createClient();
  const [photoRes, listRes, pantryItems] = await Promise.all([
    supabase
      .from("recipe_images")
      .select("id, image_url, caption, is_cover, sort_order")
      .eq("recipe_id", id)
      .eq("household_id", householdId)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("grocery_items")
      .select("id, name, catalog_product_id")
      .eq("household_id", householdId)
      .eq("checked", false),
    getRegularBuys(householdId),
  ]);

  const photos = ((photoRes.data ?? []) as unknown as (RecipePhoto & { sort_order: number })[]).map(
    ({ id: photoId, image_url, caption, is_cover }) => ({ id: photoId, image_url, caption, is_cover }),
  );

  const active: ActiveListItem[] = (
    (listRes.data ?? []) as { id: string; name: string; catalog_product_id: string | null }[]
  ).map((row) => ({ id: row.id, name: row.name, catalogProductId: row.catalog_product_id }));

  const pantry: PantryEntry[] = pantryItems.map((item) => ({
    title: item.title,
    catalogProductId: item.catalog_product_id,
    status: item.inventory_status,
  }));

  return {
    recipe,
    cover: photos.find((p) => p.is_cover) ?? null,
    gallery: photos.filter((p) => !p.is_cover),
    ingredients: recipe.ingredients.map((ingredient) => {
      const display = decodeEntities(ingredient.name);
      const match = matchIngredient(
        { name: ingredient.name, catalogProductId: ingredient.catalog_product_id },
        pantry,
      );
      return {
        ...ingredient,
        display_name: display,
        stock: stockFor(match),
        matched_title: match.entry?.title ?? null,
        matched_how: match.how,
        already_on_list:
          resolveNeedMatch(active, {
            catalogProductId: ingredient.catalog_product_id,
            name: display,
            source: "RECIPE",
          }).kind === "existing",
      };
    }),
  };
}
