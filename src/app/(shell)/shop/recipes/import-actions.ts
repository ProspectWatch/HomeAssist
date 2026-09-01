"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { fetchRecipePage } from "@/lib/recipes/fetch-page";
import { parseRecipeFromHtml, type ImportedRecipe } from "@/lib/recipes/import-url";
import { extractRecipeFromImage, isScreenshotImportConfigured } from "@/lib/recipes/extract-screenshot";
import { validateProductImage } from "@/lib/products/image-upload";
import { isMealSlot } from "@/lib/meals/week";

export type RecipeImportResult =
  | { ok: true; recipe: ImportedRecipe }
  | { ok: false; message: string };

/**
 * Read a recipe from a link.
 *
 * Returns the recipe for review rather than saving it. Every import is a
 * reading of somebody else's page and can be wrong or partial, so the last
 * word belongs to the person who pasted the link — and an ingredient list is
 * exactly the thing you want to glance over before it becomes a shopping list.
 */
export async function importRecipeFromUrl(url: string): Promise<RecipeImportResult> {
  const page = await fetchRecipePage(url);
  if (!page.ok) return page;
  return parseRecipeFromHtml(page.html, page.finalUrl);
}

/**
 * Read a recipe from a screenshot.
 *
 * The image arrives as base64 in a Server Action rather than through Storage,
 * unlike receipts and product photos. It is bounded to well under the 4.5 MB
 * function limit, and unlike those two there is nothing to keep afterwards:
 * the picture is a means of reading the words, and storing it would mean
 * holding a copy of someone else's cookbook page for no reason.
 */
export async function importRecipeFromScreenshot(image: {
  base64: string;
  mediaType: string;
}): Promise<RecipeImportResult> {
  const bytes = Buffer.from(image.base64, "base64");
  const check = validateProductImage({ size: bytes.length, mediaType: image.mediaType });
  if (!check.ok) return check;

  const result = await runHouseholdAction<RecipeImportResult>(async () =>
    extractRecipeFromImage({ bytes, mediaType: image.mediaType }),
  );
  return "recipe" in result || !result.ok ? (result as RecipeImportResult) : { ok: false, message: "Import failed." };
}

/**
 * Save a reviewed recipe as this household's own.
 *
 * Ingredients are matched to the catalogue by name so the planner can put them
 * on a shopping list and screen them for allergens. An unmatched ingredient is
 * still saved with its text — a recipe is not worth less because one line
 * doesn't map, and the list can carry a plain name.
 */
export async function saveImportedRecipe(recipe: {
  name: string;
  timeMinutes: number | null;
  servings: string | null;
  mealTypes: string[];
  ingredients: string[];
  sourceUrl: string | null;
}): Promise<ActionResult & { recipeId?: string }> {
  const name = recipe.name.trim();
  if (!name) return { ok: false, message: "Give the recipe a name." };
  const ingredients = recipe.ingredients.map((i) => i.trim()).filter(Boolean);
  if (ingredients.length === 0) return { ok: false, message: "A recipe needs at least one ingredient." };

  const mealTypes = recipe.mealTypes.filter(isMealSlot);

  return runHouseholdAction(async (supabase, householdId) => {
    const { data: created, error } = await supabase
      .from("recipes")
      .insert({
        household_id: householdId,
        name,
        time_minutes: recipe.timeMinutes,
        servings: recipe.servings,
        meal_types: mealTypes,
        notes: recipe.sourceUrl?.trim() || null,
      })
      .select("id")
      .single();
    if (error || !created) return { ok: false, message: error?.message ?? "Couldn't save that recipe." };

    // Match against the catalogue so the planner can screen and shop it. The
    // match is by name containment on a normalised string — the same shape the
    // rest of the app uses — and a miss simply leaves catalog_product_id null.
    const { data: catalog } = await supabase
      .from("catalog_products")
      .select("id, display_name")
      .eq("active", true);

    const normalise = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const byName = ((catalog ?? []) as { id: string; display_name: string }[])
      .map((c) => ({ id: c.id, key: normalise(c.display_name) }))
      // Longest first, so "Old Cheddar Cheese" wins over "Cheese".
      .sort((a, b) => b.key.length - a.key.length);

    const rows = ingredients.map((text, index) => {
      const key = normalise(text);
      const hit = byName.find((c) => c.key.length > 2 && key.includes(c.key));
      return {
        recipe_id: created.id,
        name: text,
        qty: null,
        sort_order: index,
        catalog_product_id: hit?.id ?? null,
      };
    });

    const { error: ingredientError } = await supabase.from("recipe_ingredients").insert(rows);
    if (ingredientError) {
      // The recipe without its ingredients is a trap: it would sit in the
      // planner looking usable and put nothing on a list.
      await supabase.from("recipes").delete().eq("id", created.id).eq("household_id", householdId);
      return { ok: false, message: ingredientError.message };
    }

    revalidatePath("/shop/recipes");
    revalidatePath("/shop/plan");
    return { ok: true, recipeId: created.id };
  });
}
