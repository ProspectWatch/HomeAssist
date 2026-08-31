"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";

/**
 * What one person thinks of one recipe.
 *
 * Upsert on (person, recipe) so tapping "loves" on something already marked
 * "refuses" changes their mind rather than recording both. Passing null clears
 * the opinion entirely — having no view on a meal is a real state, and is not
 * the same as being neutral about it.
 */
export async function setRecipeOpinion(
  personId: string,
  recipeId: string,
  sentiment: "LOVES" | "DISLIKES" | null,
): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    if (sentiment === null) {
      const { error } = await supabase
        .from("recipe_person_preferences")
        .delete()
        .eq("household_id", householdId)
        .eq("person_id", personId)
        .eq("recipe_id", recipeId);
      if (error) return { ok: false, message: error.message };
    } else {
      const { error } = await supabase.from("recipe_person_preferences").upsert(
        { household_id: householdId, person_id: personId, recipe_id: recipeId, sentiment },
        { onConflict: "person_id,recipe_id" },
      );
      if (error) return { ok: false, message: error.message };
    }

    revalidatePath("/family");
    revalidatePath("/shop/plan");
    return { ok: true };
  });
}
