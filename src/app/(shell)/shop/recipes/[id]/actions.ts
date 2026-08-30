"use server";

import { revalidatePath } from "next/cache";
import { addItemsToGroceryList } from "@/app/(shell)/shop/list/actions";
import { getRecipe } from "@/lib/data/recipes";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/helpers";

export async function addRecipeToList(recipeId: string): Promise<ActionResult> {
  const recipe = await getRecipe(recipeId);
  if (!recipe) return { ok: false, message: "Couldn't load that recipe." };
  return addItemsToGroceryList(
    recipe.ingredients.map((i) => ({
      name: i.name,
      qty: i.qty,
      catalogProductId: i.catalog_product_id,
    })),
    "RECIPE",
  );
}

/**
 * Links a recipe ingredient to a generic catalogue product (step 10) —
 * shopping-time resolution (preferred variant, store, deal) stays a
 * separate concern; this just records which generic product the
 * ingredient means. Pass null to unlink.
 */
export async function setRecipeIngredientCatalogProduct(
  ingredientId: string,
  catalogProductId: string | null,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("recipe_ingredients")
      .update({ catalog_product_id: catalogProductId })
      .eq("id", ingredientId);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/recipes");
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Try again." };
  }
}
