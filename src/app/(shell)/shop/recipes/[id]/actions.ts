"use server";

import { addItemsToGroceryList } from "@/app/(shell)/shop/list/actions";
import { getRecipe } from "@/lib/data/recipes";
import type { ActionResult } from "@/lib/actions/helpers";

export async function addRecipeToList(recipeId: string): Promise<ActionResult> {
  const recipe = await getRecipe(recipeId);
  if (!recipe) return { ok: false, message: "Couldn't load that recipe." };
  return addItemsToGroceryList(recipe.ingredients.map((i) => ({ name: i.name, qty: i.qty })));
}
