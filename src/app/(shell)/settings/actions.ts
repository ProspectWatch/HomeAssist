"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";

export type SaveHouseholdSettingsInput = {
  householdName: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  preferredRetailerIds: string[];
};

export async function saveHouseholdSettings(input: SaveHouseholdSettingsInput): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const name = input.householdName.trim();
    if (!name) return { ok: false, message: "Household name can't be empty." };

    const { error: nameError } = await supabase
      .from("households")
      .update({ name })
      .eq("id", householdId);
    if (nameError) return { ok: false, message: nameError.message };

    const { error } = await supabase.from("household_settings").upsert({
      household_id: householdId,
      postal_code: input.postalCode.trim() || null,
      city: input.city.trim() || null,
      province: input.province.trim() || null,
      country: input.country.trim() || "Canada",
      preferred_retailer_ids: input.preferredRetailerIds,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/settings");
    return { ok: true };
  });
}
