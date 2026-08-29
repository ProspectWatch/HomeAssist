"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";

export async function saveHouseholdSettings(input: { postalCode: string; city: string }): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase.from("household_settings").upsert({
      household_id: householdId,
      postal_code: input.postalCode || null,
      city: input.city || null,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/settings");
    return { ok: true };
  });
}
