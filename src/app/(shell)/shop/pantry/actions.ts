"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";

export async function addPantryRegularBuy(
  title: string,
  options?: { catalogProductId?: string | null; imageUrl?: string | null; packageDetail?: string | null },
): Promise<ActionResult> {
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, message: "Type something to add first." };

  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase.from("products").insert({
      household_id: householdId,
      title: trimmed,
      department_key: "kitchen",
      is_regular_buy: true,
      catalog_product_id: options?.catalogProductId ?? null,
      image_url: options?.imageUrl ?? null,
      package_detail: options?.packageDetail ?? null,
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/pantry");
    return { ok: true };
  });
}

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
