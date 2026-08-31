import { createClient } from "@/lib/supabase/server";
import { getHiddenRecipeIds } from "@/lib/data/recipes";
import { getHouseholdPeople } from "@/lib/data/people";
import { screenMeal, type MealScreen, type ScreenablePerson } from "@/lib/meals/allergens";
import {
  addDays,
  isMealSlot,
  type MealSlot,
  type PlannedMeal,
} from "@/lib/meals/week";

export type PlannableRecipe = {
  id: string;
  name: string;
  timeMinutes: number | null;
  servings: string | null;
  mealTypes: MealSlot[];
  isHouseholds: boolean;
  ingredients: { name: string; catalogProductId: string | null; qty: string | null }[];
};

/**
 * Recipes that can be put in a slot: the shared starter set plus this
 * household's own. RLS already limits the rows; the query is written to match
 * so a policy change shows up as missing recipes rather than as a leak.
 */
export async function getPlannableRecipes(householdId: string | null): Promise<PlannableRecipe[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("recipes")
      .select(
        "id, name, time_minutes, servings, meal_types, household_id, recipe_ingredients(name, qty, catalog_product_id, sort_order)",
      )
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .order("name");
    if (error || !data) return [];

    // A starter recipe the household has removed should not come back as
    // something to plan.
    const hidden = await getHiddenRecipeIds();

    type Row = {
      id: string;
      name: string;
      time_minutes: number | null;
      servings: string | null;
      meal_types: string[] | null;
      household_id: string | null;
      recipe_ingredients: {
        name: string;
        qty: string | null;
        catalog_product_id: string | null;
        sort_order: number | null;
      }[];
    };

    return (data as unknown as Row[]).filter((row) => !hidden.has(row.id)).map((row) => ({
      id: row.id,
      name: row.name,
      timeMinutes: row.time_minutes,
      servings: row.servings,
      mealTypes: (row.meal_types ?? []).filter(isMealSlot),
      isHouseholds: row.household_id !== null,
      ingredients: [...(row.recipe_ingredients ?? [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((i) => ({ name: i.name, catalogProductId: i.catalog_product_id, qty: i.qty })),
    }));
  } catch {
    return [];
  }
}

export type PlannedMealWithScreen = PlannedMeal & {
  /** Null when the meal is a plain line with no recipe behind it to read. */
  screen: MealScreen | null;
};

export type WeekPlan = {
  meals: PlannedMealWithScreen[];
  people: ScreenablePerson[];
};

/**
 * One week of meals, each screened against whoever is actually eating it.
 *
 * Who is eating decides what gets screened: a household entry is screened
 * against everyone, a person's entry against that person. Screening a packed
 * lunch against the whole family would flag Sam's peanut butter because Ella is
 * allergic, and warnings that fire on meals nobody is eating are the fastest
 * way to teach someone to ignore them.
 */
export async function getWeekPlan(
  householdId: string | null,
  startIso: string,
): Promise<WeekPlan> {
  if (!householdId) return { meals: [], people: [] };
  try {
    const supabase = await createClient();
    const endIso = addDays(startIso, 6);

    const [planRes, householdPeople] = await Promise.all([
      supabase
        .from("meal_plan_entries")
        .select(
          "id, plan_date, slot, title, note, person_id, recipe_id, person:household_people(name), recipe:recipes(name, time_minutes, recipe_ingredients(name))",
        )
        .eq("household_id", householdId)
        .gte("plan_date", startIso)
        .lte("plan_date", endIso),
      getHouseholdPeople(householdId),
    ]);

    const people: ScreenablePerson[] = householdPeople.map((p) => ({
      id: p.id,
      name: p.name,
      allergies: p.allergies,
      dislikes: p.dislikes,
    }));
    const byId = new Map(people.map((p) => [p.id, p]));

    type Row = {
      id: string;
      plan_date: string;
      slot: string;
      title: string | null;
      note: string | null;
      person_id: string | null;
      recipe_id: string | null;
      person: { name: string } | null;
      recipe: {
        name: string;
        time_minutes: number | null;
        recipe_ingredients: { name: string }[];
      } | null;
    };

    const meals = ((planRes.data ?? []) as unknown as Row[])
      .filter((row) => isMealSlot(row.slot))
      .map((row) => {
        const eaters = row.person_id
          ? [byId.get(row.person_id)].filter((p): p is ScreenablePerson => !!p)
          : people;
        return {
          id: row.id,
          date: row.plan_date,
          slot: row.slot as MealSlot,
          recipeId: row.recipe_id,
          // A recipe names itself; a plain line is whatever was typed. One of
          // the two is guaranteed by a check constraint, so the fallback here
          // is for a recipe deleted out from under a plan.
          title: row.recipe?.name ?? row.title ?? "Untitled",
          personId: row.person_id,
          personName: row.person?.name ?? null,
          timeMinutes: row.recipe?.time_minutes ?? null,
          note: row.note,
          screen: row.recipe ? screenMeal(row.recipe.recipe_ingredients ?? [], eaters) : null,
        };
      });

    return { meals, people };
  } catch {
    return { meals: [], people: [] };
  }
}

/**
 * Every ingredient the planned week needs, deduplicated.
 *
 * Quantities are deliberately not summed. Two recipes each wanting "1 onion"
 * is two onions, but one wanting "1 cup rice" and another "200g rice" is not
 * arithmetic this can do honestly, and a wrong number on a shopping list is
 * worse than no number. The list carries the item and leaves the quantity to
 * the person holding the basket.
 */
export async function getWeekIngredients(
  householdId: string | null,
  startIso: string,
): Promise<{ name: string; catalogProductId: string | null; fromRecipes: string[] }[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const endIso = addDays(startIso, 6);
    const { data, error } = await supabase
      .from("meal_plan_entries")
      .select("recipe:recipes(name, recipe_ingredients(name, catalog_product_id))")
      .eq("household_id", householdId)
      .gte("plan_date", startIso)
      .lte("plan_date", endIso)
      .not("recipe_id", "is", null);
    if (error || !data) return [];

    type Row = {
      recipe: {
        name: string;
        recipe_ingredients: { name: string; catalog_product_id: string | null }[];
      } | null;
    };

    const byKey = new Map<string, { name: string; catalogProductId: string | null; fromRecipes: string[] }>();
    for (const row of data as unknown as Row[]) {
      if (!row.recipe) continue;
      for (const ingredient of row.recipe.recipe_ingredients ?? []) {
        // Key on the catalogue product where there is one, so "Onion" from one
        // recipe and "Onions" from another are a single line.
        const key = ingredient.catalog_product_id ?? ingredient.name.trim().toLowerCase();
        const existing = byKey.get(key);
        if (existing) {
          if (!existing.fromRecipes.includes(row.recipe.name)) {
            existing.fromRecipes.push(row.recipe.name);
          }
        } else {
          byKey.set(key, {
            name: ingredient.name,
            catalogProductId: ingredient.catalog_product_id,
            fromRecipes: [row.recipe.name],
          });
        }
      }
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
