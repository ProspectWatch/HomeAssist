import { createClient } from "@/lib/supabase/server";
import { sortPeople, type HouseholdPerson } from "@/lib/household/people";

/** Everyone in the household — adults, children, whether or not they sign in. */
export async function getHouseholdPeople(householdId: string | null): Promise<HouseholdPerson[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("household_people")
      .select("id, name, is_child, user_id, allergies, dislikes")
      .eq("household_id", householdId);
    if (error || !data) return [];
    type Row = {
      id: string;
      name: string;
      is_child: boolean;
      user_id: string | null;
      allergies: string[] | null;
      dislikes: string[] | null;
    };
    return sortPeople(
      (data as Row[]).map((r) => ({
        id: r.id,
        name: r.name,
        isChild: r.is_child,
        hasLogin: r.user_id !== null,
        allergies: r.allergies ?? [],
        dislikes: r.dislikes ?? [],
      })),
    );
  } catch {
    return [];
  }
}
