"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";

export async function addGroceryItem(
  name: string,
  options?: { catalogProductId?: string | null; category?: string | null },
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Type something to add first." };

  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase.from("grocery_items").insert({
      household_id: householdId,
      name: trimmed,
      catalog_product_id: options?.catalogProductId ?? null,
      ...(options?.category ? { category: options.category } : {}),
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/list");
    revalidatePath("/home");
    return { ok: true };
  });
}

export async function toggleGroceryItem(id: string, checked: boolean): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("grocery_items")
      .update({ checked })
      .eq("id", id)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/list");
    return { ok: true };
  });
}

export async function clearPurchasedItems(): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("grocery_items")
      .delete()
      .eq("household_id", householdId)
      .eq("checked", true);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/list");
    return { ok: true };
  });
}

export async function addItemsToGroceryList(
  items: { name: string; qty?: string | null }[],
): Promise<ActionResult> {
  if (items.length === 0) return { ok: true };

  return runHouseholdAction(async (supabase, householdId) => {
    const { data: existing } = await supabase
      .from("grocery_items")
      .select("name")
      .eq("household_id", householdId);
    const existingNames = new Set((existing ?? []).map((r) => r.name.toLowerCase()));
    const toInsert = items
      .filter((i) => !existingNames.has(i.name.toLowerCase()))
      .map((i) => ({ household_id: householdId, name: i.name, qty: i.qty ?? null }));
    if (toInsert.length === 0) return { ok: true };

    const { error } = await supabase.from("grocery_items").insert(toInsert);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/list");
    revalidatePath("/home");
    return { ok: true };
  });
}
