"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";

export async function addPantryItemToTrip(name: string, qty: string | null): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { data: existing } = await supabase
      .from("grocery_items")
      .select("id")
      .eq("household_id", householdId)
      .eq("name", name)
      .maybeSingle();
    if (existing) return { ok: true };

    const { error } = await supabase.from("grocery_items").insert({
      household_id: householdId,
      name,
      qty,
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/list");
    revalidatePath("/shop/pantry");
    revalidatePath("/home");
    return { ok: true };
  });
}
