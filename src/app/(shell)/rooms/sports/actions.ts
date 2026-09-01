"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";

/**
 * Adding an athlete.
 *
 * The Sports screen, the per-athlete screen, the athlete picker on the watch
 * form and the equipment tracking were all built against this table, and
 * nothing anywhere could put a row in it. Every one of those was unreachable:
 * the screen said "add a household athlete" and offered no way to.
 *
 * An athlete is optionally the same person as a household_people row — the
 * kid who plays hockey is also the kid with the peanut allergy — so linking
 * them is offered rather than keeping two unrelated lists of the same children.
 */
export async function addAthlete(input: {
  name: string;
  sport: string;
  personId: string | null;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Give the athlete a name." };

  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase.from("athletes").insert({
      household_id: householdId,
      name: name.slice(0, 60),
      sport: input.sport.trim() || null,
      person_id: input.personId,
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/rooms/sports");
    revalidatePath("/rooms");
    return { ok: true };
  });
}

export async function removeAthlete(id: string): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { data, error } = await supabase
      .from("athletes")
      .delete()
      .eq("id", id)
      .eq("household_id", householdId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!data) return { ok: false, message: "That athlete is already gone." };
    revalidatePath("/rooms/sports");
    return { ok: true };
  });
}
