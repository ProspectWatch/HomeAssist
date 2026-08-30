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
    // A catalogue-backed pick becomes a regular buy in the household
    // preference layer, matching how the seeded library is stored. Upserting
    // on the (household_id, scope_type, scope_key) unique key keeps re-adding
    // the same product idempotent instead of duplicating it.
    if (options?.catalogProductId) {
      const { error } = await supabase.from("household_product_preferences").upsert(
        {
          household_id: householdId,
          scope_type: "product",
          scope_key: options.catalogProductId,
          label: trimmed,
          regular_buy: true,
        },
        { onConflict: "household_id,scope_type,scope_key" },
      );
      if (error) return { ok: false, message: error.message };
      revalidatePath("/shop/pantry");
      return { ok: true };
    }

    // A free-typed item has no catalogue row to point at, so it stays a
    // household-owned product SKU.
    const { error } = await supabase.from("products").insert({
      household_id: householdId,
      title: trimmed,
      department_key: "kitchen",
      is_regular_buy: true,
      catalog_product_id: null,
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
