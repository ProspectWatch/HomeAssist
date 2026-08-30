"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import type { InventoryStatus } from "@/lib/data/inventory";
import { resolveNeedMatch, type ActiveListItem, type HouseholdNeed } from "@/lib/household/needs";

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

/**
 * Records what the household has right now. Deliberately writes to
 * household_inventory_state and nothing else — marking something OUT never
 * silently adds it to the list (§9); the UI offers that as an explicit next
 * tap instead.
 */
export async function setInventoryStatus(
  catalogProductId: string,
  status: InventoryStatus,
): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("household_inventory_state").upsert(
      {
        household_id: householdId,
        catalog_product_id: catalogProductId,
        status,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "household_id,catalog_product_id" },
    );
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/pantry");
    revalidatePath("/shop/pantry/check");
    revalidatePath("/home");
    return { ok: true };
  });
}

export type AddNeedResult = ActionResult & { alreadyOnList?: boolean };

/**
 * THE canonical way to add a household need to the grocery list.
 *
 * Every caller — Pantry quick actions, Pantry Check, recipes, and later a
 * voice assistant — routes through here so product matching and duplicate
 * protection can't be bypassed. The need is kept generic on purpose: no
 * retailer is assigned here (§11) and the brand/variant preference is left in
 * the preference layer for Shopping Intelligence to resolve once real pricing
 * exists (§10).
 */
export async function addHouseholdNeed(need: HouseholdNeed): Promise<AddNeedResult> {
  const name = need.name.trim();
  if (!name) return { ok: false, message: "Nothing to add." };

  return runHouseholdAction(async (supabase, householdId) => {
    const { data, error: listError } = await supabase
      .from("grocery_items")
      .select("id, name, catalog_product_id")
      .eq("household_id", householdId)
      .eq("checked", false);
    if (listError) return { ok: false, message: listError.message };

    const activeItems: ActiveListItem[] = (
      (data ?? []) as { id: string; name: string; catalog_product_id: string | null }[]
    ).map((row) => ({ id: row.id, name: row.name, catalogProductId: row.catalog_product_id }));

    const match = resolveNeedMatch(activeItems, { ...need, name });

    if (match.kind === "existing") {
      // Already needed — keep the single row rather than adding a second.
      // Quantity/note are only ever added, never blanked out by a repeat tap.
      const patch: { qty?: string; note?: string } = {};
      if (need.quantity) patch.qty = need.quantity;
      if (need.note) patch.note = need.note;
      if (patch.qty !== undefined || patch.note !== undefined) {
        await supabase.from("grocery_items").update(patch).eq("id", match.itemId).eq("household_id", householdId);
      }
      revalidatePath("/shop/list");
      revalidatePath("/shop/pantry");
      revalidatePath("/shop/pantry/check");
      revalidatePath("/home");
      return { ok: true, alreadyOnList: true };
    }

    const { error } = await supabase.from("grocery_items").insert({
      household_id: householdId,
      name,
      catalog_product_id: need.catalogProductId,
      qty: need.quantity ?? null,
      note: need.note ?? null,
      source: need.source,
      // No retailer_id: Shopping Intelligence decides the store once real
      // pricing exists (§11).
    });
    if (error) return { ok: false, message: error.message };

    revalidatePath("/shop/list");
    revalidatePath("/shop/pantry");
    revalidatePath("/shop/pantry/check");
    revalidatePath("/home");
    return { ok: true, alreadyOnList: false };
  });
}

/** Pantry "+ List" / "Add to List" — a household need sourced from the pantry. */
export async function addPantryItemToTrip(
  name: string,
  qty: string | null,
  catalogProductId?: string | null,
): Promise<AddNeedResult> {
  return addHouseholdNeed({
    catalogProductId: catalogProductId ?? null,
    name,
    quantity: qty,
    source: "PANTRY",
  });
}
