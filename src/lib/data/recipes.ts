import { createClient } from "@/lib/supabase/server";

export type RecipeSummary = {
  id: string;
  name: string;
  time_minutes: number | null;
  servings: string | null;
  ingredient_count: number;
  store_count: number;
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
  ingredients: RecipeIngredient[];
};

export async function getRecipes(): Promise<RecipeSummary[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("recipes")
      .select("id, name, time_minutes, servings, recipe_ingredients(usual_retailer_id)")
      .order("name", { ascending: true });
    if (error || !data) return [];
    type Row = { id: string; name: string; time_minutes: number | null; servings: string | null; recipe_ingredients: { usual_retailer_id: string | null }[] };
    return (data as unknown as Row[]).map((r) => ({
      id: r.id,
      name: r.name,
      time_minutes: r.time_minutes,
      servings: r.servings,
      ingredient_count: r.recipe_ingredients.length,
      store_count: new Set(r.recipe_ingredients.map((i) => i.usual_retailer_id).filter(Boolean)).size,
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
        "id, name, time_minutes, servings, recipe_ingredients(id, name, qty, sort_order, catalog_product_id, retailer:retailers(name))",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    type Row = {
      id: string;
      name: string;
      time_minutes: number | null;
      servings: string | null;
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
      ingredients: [...r.recipe_ingredients]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({ id: i.id, name: i.name, qty: i.qty, retailer: i.retailer, catalog_product_id: i.catalog_product_id })),
    };
  } catch {
    return null;
  }
}
