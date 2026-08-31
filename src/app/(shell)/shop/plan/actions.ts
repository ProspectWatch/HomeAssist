"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { addHouseholdNeed } from "@/app/(shell)/shop/pantry/actions";
import { getWeekIngredients } from "@/lib/data/meal-plan";
import { isMealSlot } from "@/lib/meals/week";

const TOUCHED = ["/shop/plan", "/shop/list", "/home"];

function revalidateAll() {
  for (const path of TOUCHED) revalidatePath(path);
}

/**
 * Put a meal in a slot.
 *
 * Either a recipe or a typed line — "Leftovers" is a real plan and should not
 * need a recipe invented for it. `personId` null means the whole household
 * eats it, which is the difference between a dinner and a packed lunch.
 */
export async function planMeal(entry: {
  date: string;
  slot: string;
  recipeId?: string | null;
  title?: string | null;
  personId?: string | null;
  note?: string | null;
}): Promise<ActionResult> {
  if (!isMealSlot(entry.slot)) return { ok: false, message: "That isn't a meal slot." };
  const title = entry.title?.trim() || null;
  if (!entry.recipeId && !title) return { ok: false, message: "Pick a recipe or type what you're having." };

  return runHouseholdAction(async (supabase, householdId) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("meal_plan_entries").insert({
      household_id: householdId,
      plan_date: entry.date,
      slot: entry.slot,
      recipe_id: entry.recipeId ?? null,
      title: entry.recipeId ? null : title,
      person_id: entry.personId ?? null,
      note: entry.note?.trim() || null,
      created_by: user?.id ?? null,
    });
    if (error) return { ok: false, message: error.message };

    revalidateAll();
    return { ok: true };
  });
}

export async function unplanMeal(entryId: string): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("meal_plan_entries")
      .delete()
      .eq("id", entryId)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };
    revalidateAll();
    return { ok: true };
  });
}

export type AddWeekResult = ActionResult & { added?: number; alreadyThere?: number };

/**
 * Push everything the planned week needs onto the shopping list.
 *
 * Routed through addHouseholdNeed rather than inserting directly, so the
 * duplicate protection and catalogue matching every other path uses apply here
 * too — running this twice on a Wednesday must not produce two of everything.
 * It reports what it actually did rather than claiming a number: "12 added, 4
 * already there" is the truth, and "16 added" would not be.
 */
export async function addWeekToList(startIso: string): Promise<AddWeekResult> {
  const householdResult = await runHouseholdAction(async (_supabase, householdId) => ({
    ok: true as const,
    householdId,
  }));
  if (!("householdId" in householdResult)) return householdResult;

  const ingredients = await getWeekIngredients(householdResult.householdId, startIso);
  if (ingredients.length === 0) {
    return { ok: false, message: "Nothing planned this week has a recipe behind it yet." };
  }

  let added = 0;
  let alreadyThere = 0;
  for (const ingredient of ingredients) {
    const res = await addHouseholdNeed({
      catalogProductId: ingredient.catalogProductId,
      name: ingredient.name,
      quantity: null,
      source: "RECIPE",
      note: ingredient.fromRecipes.slice(0, 2).join(", "),
    });
    if (!res.ok) continue;
    if (res.alreadyOnList) alreadyThere += 1;
    else added += 1;
  }

  revalidateAll();
  return { ok: true, added, alreadyThere };
}
