"use server";

import { revalidatePath } from "next/cache";
import { addItemsToGroceryList } from "@/app/(shell)/shop/list/actions";
import { getRecipe } from "@/lib/data/recipes";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { getRecipeKitchen } from "@/lib/data/recipes";
import { needsBuying } from "@/lib/recipes/ingredient-match";
import {
  buildProductImagePath,
  productImagePathBelongsToHousehold,
  productImagePublicUrl,
  validateProductImage,
} from "@/lib/products/image-upload";

export type RecipeImageTarget = { ok: true; storagePath: string } | { ok: false; message: string };

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

/**
 * Step 1 of adding a recipe photo: issue the path the browser uploads to.
 *
 * Same two-step as the pantry's product photos, and for the same reason — the
 * bytes never pass through a Server Action, because a Vercel Function refuses
 * a body over 4.5 MB and a phone photo clears that routinely. The server mints
 * the path because its first segment is the household folder the storage
 * policy checks, and re-checks it before recording it.
 */
export async function prepareRecipeImageUpload(file: {
  filename: string;
  mediaType: string;
  size: number;
}): Promise<RecipeImageTarget> {
  const check = validateProductImage({ size: file.size, mediaType: file.mediaType });
  if (!check.ok) return check;

  const result = await runHouseholdAction<RecipeImageTarget>(async (_supabase, householdId) => ({
    ok: true,
    storagePath: buildProductImagePath(householdId, file.filename, crypto.randomUUID()),
  }));
  return "storagePath" in result
    ? result
    : { ok: false, message: "Couldn't start that upload — try again." };
}

/**
 * Step 2: record an uploaded photo against a recipe.
 *
 * Both the cover and the gallery land here. A cover replaces the previous one
 * rather than stacking, which is what the partial unique index enforces — the
 * old cover is demoted to the gallery rather than deleted, because the photo
 * is still a photo of this dish and throwing it away was not what was asked.
 */
export async function addRecipeImage(input: {
  recipeId: string;
  storagePath: string;
  isCover: boolean;
  caption?: string | null;
}): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    // The browser hands this path back, so it is re-checked before anything
    // renders it. Storage RLS already refused a write outside the household's
    // folder; this stops an arbitrary string becoming an <img src>.
    if (!productImagePathBelongsToHousehold(input.storagePath, householdId)) {
      return { ok: false, message: "That photo couldn't be attached — try taking it again." };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return { ok: false, message: "Image storage isn't configured." };
    const imageUrl = productImagePublicUrl(supabaseUrl, input.storagePath);

    if (input.isCover) {
      const { error: demoteError } = await supabase
        .from("recipe_images")
        .update({ is_cover: false })
        .eq("recipe_id", input.recipeId)
        .eq("household_id", householdId)
        .eq("is_cover", true);
      if (demoteError) return { ok: false, message: demoteError.message };
    }

    const { error } = await supabase.from("recipe_images").insert({
      recipe_id: input.recipeId,
      household_id: householdId,
      image_url: imageUrl,
      is_cover: input.isCover,
      caption: input.caption?.trim() || null,
    });
    if (error) return { ok: false, message: error.message };

    revalidatePath(`/shop/recipes/${input.recipeId}`);
    revalidatePath("/shop/recipes");
    return { ok: true };
  });
}

/** Promotes a gallery photo to the cover. */
export async function setRecipeCoverImage(recipeId: string, imageId: string): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { error: demoteError } = await supabase
      .from("recipe_images")
      .update({ is_cover: false })
      .eq("recipe_id", recipeId)
      .eq("household_id", householdId)
      .eq("is_cover", true);
    if (demoteError) return { ok: false, message: demoteError.message };

    const { error } = await supabase
      .from("recipe_images")
      .update({ is_cover: true })
      .eq("id", imageId)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };

    revalidatePath(`/shop/recipes/${recipeId}`);
    revalidatePath("/shop/recipes");
    return { ok: true };
  });
}

/**
 * Removes a photo from the recipe.
 *
 * The row goes; the object stays in Storage. Deleting the object is a separate
 * decision with its own failure mode — a delete that half-succeeds leaves a
 * recipe pointing at nothing — and an unreferenced image costs a few hundred
 * kilobytes.
 */
export async function removeRecipeImage(recipeId: string, imageId: string): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("recipe_images")
      .delete()
      .eq("id", imageId)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };

    revalidatePath(`/shop/recipes/${recipeId}`);
    revalidatePath("/shop/recipes");
    return { ok: true };
  });
}

/** Puts one ingredient on the list, from the recipe screen. */
export async function addIngredientToList(input: {
  recipeId: string;
  name: string;
  qty: string | null;
  catalogProductId: string | null;
}): Promise<ActionResult> {
  const result = await addItemsToGroceryList(
    [{ name: input.name, qty: input.qty, catalogProductId: input.catalogProductId }],
    "RECIPE",
  );
  if (result.ok) revalidatePath(`/shop/recipes/${input.recipeId}`);
  return result;
}

/**
 * Puts the ingredients this kitchen is low on or out of on the list.
 *
 * Not the untracked ones. An ingredient the app could not place is not an
 * ingredient the household is out of, and quietly buying salt every week
 * because nobody has ever ticked it in the Pantry is the failure this avoids.
 */
export async function addMissingIngredientsToList(recipeId: string): Promise<ActionResult> {
  const householdId = await getCurrentHouseholdId();
  const kitchen = await getRecipeKitchen(recipeId, householdId);
  if (!kitchen) return { ok: false, message: "Couldn't load that recipe." };

  const missing = kitchen.ingredients.filter((i) => needsBuying(i.stock));
  if (missing.length === 0) {
    return { ok: false, message: "Nothing is marked low or out — add individually if you need it." };
  }

  const result = await addItemsToGroceryList(
    missing.map((i) => ({
      name: i.display_name,
      qty: i.qty,
      catalogProductId: i.catalog_product_id,
    })),
    "RECIPE",
  );
  if (result.ok) revalidatePath(`/shop/recipes/${recipeId}`);
  return result;
}
