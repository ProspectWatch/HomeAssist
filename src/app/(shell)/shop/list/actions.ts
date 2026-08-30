"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { resolveNeedMatch, type ActiveListItem, type NeedSource } from "@/lib/household/needs";

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
  items: { name: string; qty?: string | null; catalogProductId?: string | null }[],
  source: NeedSource = "MANUAL",
): Promise<ActionResult> {
  if (items.length === 0) return { ok: true };

  return runHouseholdAction(async (supabase, householdId) => {
    const { data } = await supabase
      .from("grocery_items")
      .select("id, name, catalog_product_id")
      .eq("household_id", householdId)
      .eq("checked", false);

    // Track what we're about to add as well as what's already there, so a
    // recipe listing the same ingredient twice still yields one row.
    const active: ActiveListItem[] = (
      (data ?? []) as { id: string; name: string; catalog_product_id: string | null }[]
    ).map((row) => ({ id: row.id, name: row.name, catalogProductId: row.catalog_product_id }));

    const toInsert: {
      household_id: string;
      name: string;
      qty: string | null;
      catalog_product_id: string | null;
      source: NeedSource;
    }[] = [];

    for (const item of items) {
      const name = item.name.trim();
      if (!name) continue;
      const need = { catalogProductId: item.catalogProductId ?? null, name, source };
      if (resolveNeedMatch(active, need).kind === "existing") continue;
      toInsert.push({
        household_id: householdId,
        name,
        qty: item.qty ?? null,
        catalog_product_id: need.catalogProductId,
        source,
      });
      // A pending insert counts as present for the rest of this batch.
      active.push({ id: `pending:${name}`, name, catalogProductId: need.catalogProductId });
    }

    if (toInsert.length === 0) return { ok: true };

    const { error } = await supabase.from("grocery_items").insert(toInsert);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/list");
    revalidatePath("/shop/pantry");
    revalidatePath("/home");
    return { ok: true };
  });
}
