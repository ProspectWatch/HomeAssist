import { createClient } from "@/lib/supabase/server";
import { getHouseholdPeople } from "@/lib/data/people";
import type { HouseholdPerson } from "@/lib/household/people";

export type RecipeOpinion = { recipeId: string; recipeName: string; sentiment: "LOVES" | "DISLIKES" };

export type FamilyMember = HouseholdPerson & {
  loves: RecipeOpinion[];
  refuses: RecipeOpinion[];
};

/**
 * Everyone in the household with everything the meal planner needs to know
 * about them, in one read.
 *
 * This exists because the information was scattered: names in one place,
 * allergies added later in another, and opinions about specific meals nowhere
 * at all. A family screen that has to be assembled from three round trips ends
 * up showing three different partial answers.
 */
export async function getFamily(householdId: string | null): Promise<FamilyMember[]> {
  if (!householdId) return [];
  try {
    const [people, supabase] = await Promise.all([
      getHouseholdPeople(householdId),
      createClient(),
    ]);
    if (people.length === 0) return [];

    const { data } = await supabase
      .from("recipe_person_preferences")
      .select("person_id, sentiment, recipe:recipes(id, name)")
      .eq("household_id", householdId);

    type Row = {
      person_id: string;
      sentiment: string;
      recipe: { id: string; name: string } | null;
    };

    const byPerson = new Map<string, RecipeOpinion[]>();
    for (const row of (data ?? []) as unknown as Row[]) {
      if (!row.recipe) continue;
      const list = byPerson.get(row.person_id) ?? [];
      list.push({
        recipeId: row.recipe.id,
        recipeName: row.recipe.name,
        sentiment: row.sentiment === "DISLIKES" ? "DISLIKES" : "LOVES",
      });
      byPerson.set(row.person_id, list);
    }

    return people.map((person) => {
      const opinions = byPerson.get(person.id) ?? [];
      return {
        ...person,
        loves: opinions.filter((o) => o.sentiment === "LOVES"),
        refuses: opinions.filter((o) => o.sentiment === "DISLIKES"),
      };
    });
  } catch {
    return [];
  }
}
