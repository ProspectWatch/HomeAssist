"use server";

import { revalidatePath } from "next/cache";
import { addItemsToGroceryList } from "@/app/(shell)/shop/list/actions";
import { getRecipe } from "@/lib/data/recipes";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { getRecipeKitchen } from "@/lib/data/recipes";
import { needsBuying } from "@/lib/recipes/ingredient-match";
import { planIngredientEdit } from "@/lib/recipes/edit-ingredients";
import { isMealSlot } from "@/lib/meals/week";
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
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .update({ catalog_product_id: catalogProductId })
      .eq("id", ingredientId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    // 0035 scoped this write to the household's own recipes. An update that
    // matches no row is RLS refusing it, not a success with nothing to do, and
    // reporting it as a success would leave a link that was never made.
    if (!data) {
      return { ok: false, message: "That's one of the shared starter recipes — it can't be changed." };
    }
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

/**
 * Rewrites a recipe the household owns.
 *
 * Ingredients are edited as text, one per line, but the rows behind that text
 * carry the catalogue links that tell the recipe screen whether the kitchen
 * has each thing. Rewriting by delete-all-and-reinsert would be simpler and
 * would throw all of that away on a typo fix, so the plan keeps the rows whose
 * line is unchanged and touches only real additions and removals.
 *
 * A newly typed line is matched against the catalogue the same way an import
 * does it, so an ingredient added by hand starts out as useful as one that
 * arrived from a website.
 */
export async function updateRecipe(input: {
  recipeId: string;
  name: string;
  timeMinutes: number | null;
  servings: string | null;
  mealTypes: string[];
  notes: string | null;
  ingredients: string[];
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Give the recipe a name." };
  const lines = input.ingredients.map((i) => i.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, message: "A recipe needs at least one ingredient." };

  const mealTypes = input.mealTypes.filter(isMealSlot);

  return runHouseholdAction(async (supabase, householdId) => {
    // Scoped to the household, so an attempt to edit a shared starter recipe
    // updates nothing rather than half-succeeding. RLS refuses it too; this
    // makes the app's own answer the same as the database's.
    const { data: updated, error } = await supabase
      .from("recipes")
      .update({
        name,
        time_minutes: input.timeMinutes,
        servings: input.servings?.trim() || null,
        meal_types: mealTypes,
        notes: input.notes?.trim() || null,
      })
      .eq("id", input.recipeId)
      .eq("household_id", householdId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!updated) {
      return { ok: false, message: "That's one of the shared starter recipes — it can't be edited." };
    }

    const { data: existing, error: readError } = await supabase
      .from("recipe_ingredients")
      .select("id, name")
      .eq("recipe_id", input.recipeId);
    if (readError) return { ok: false, message: readError.message };

    const plan = planIngredientEdit(
      (existing ?? []) as { id: string; name: string }[],
      lines,
    );

    // Removals first: a line moved out of the list should not collide with the
    // renumbering of the lines that stayed.
    if (plan.deleteIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("recipe_ingredients")
        .delete()
        .in("id", plan.deleteIds);
      if (deleteError) return { ok: false, message: deleteError.message };
    }

    for (const row of plan.keep) {
      const { error: orderError } = await supabase
        .from("recipe_ingredients")
        .update({ sort_order: row.sortOrder })
        .eq("id", row.id);
      if (orderError) return { ok: false, message: orderError.message };
    }

    if (plan.insert.length > 0) {
      const { data: catalog } = await supabase
        .from("catalog_products")
        .select("id, display_name")
        .eq("active", true);
      const normalise = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const byName = ((catalog ?? []) as { id: string; display_name: string }[])
        .map((c) => ({ id: c.id, key: normalise(c.display_name) }))
        // Longest first, so "Old Cheddar Cheese" wins over "Cheese".
        .sort((a, b) => b.key.length - a.key.length);

      const { error: insertError } = await supabase.from("recipe_ingredients").insert(
        plan.insert.map((row) => {
          const key = normalise(row.name);
          const hit = byName.find((c) => c.key.length > 2 && key.includes(c.key));
          return {
            recipe_id: input.recipeId,
            name: row.name,
            qty: null,
            sort_order: row.sortOrder,
            catalog_product_id: hit?.id ?? null,
          };
        }),
      );
      if (insertError) return { ok: false, message: insertError.message };
    }

    revalidatePath(`/shop/recipes/${input.recipeId}`);
    revalidatePath("/shop/recipes");
    revalidatePath("/shop/plan");
    return { ok: true };
  });
}

/**
 * Deletes a recipe the household owns.
 *
 * Its ingredients and photos go with it — those foreign keys cascade — but two
 * things deliberately survive.
 *
 * Anything already on the shopping list stays. Those rows are a decision about
 * this week's shop, not part of the recipe, and removing them because a recipe
 * was tidied away would lose a real intention.
 *
 * A week it was planned into keeps the meal, as a typed line. meal_plan_entries
 * has ON DELETE SET NULL on recipe_id and a check that an entry names either a
 * recipe or a title, so a planned recipe could not be deleted at all: the null
 * would violate the check and the delete would fail with an error nobody could
 * act on. Writing the name into title first both fixes that and is the right
 * answer anyway — Thursday's dinner was still Caldo Verde, whatever happened to
 * the recipe afterwards.
 */
export async function deleteRecipe(recipeId: string): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { data: recipe } = await supabase
      .from("recipes")
      .select("name")
      .eq("id", recipeId)
      .eq("household_id", householdId)
      .maybeSingle();

    if (recipe) {
      const { error: planError } = await supabase
        .from("meal_plan_entries")
        .update({ title: recipe.name })
        .eq("recipe_id", recipeId)
        .eq("household_id", householdId)
        .is("title", null);
      if (planError) return { ok: false, message: planError.message };
    }

    const { data: removed, error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", recipeId)
      .eq("household_id", householdId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!removed) {
      return { ok: false, message: "That's one of the shared starter recipes — it can't be deleted." };
    }

    revalidatePath("/shop/recipes");
    revalidatePath("/shop/plan");
    revalidatePath("/home");
    return { ok: true };
  });
}
