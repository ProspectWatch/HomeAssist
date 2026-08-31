"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import type { InventoryStatus } from "@/lib/data/inventory";
import { resolveNeedMatch, type ActiveListItem, type HouseholdNeed } from "@/lib/household/needs";
import {
  buildProductImagePath,
  productImagePathBelongsToHousehold,
  productImagePublicUrl,
  validateProductImage,
} from "@/lib/products/image-upload";

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

export type PantryImageTarget = { ok: true; storagePath: string } | { ok: false; message: string };

/**
 * Step 1 of setting a product photo: issue the path the browser uploads to.
 *
 * The photo does not travel through this Server Action — a Vercel Function
 * rejects a body over 4.5 MB and a phone photo clears that routinely, so the
 * browser uploads to Storage under its own session and hands back the path.
 * Only the server mints one, because that path's first segment is the
 * household folder the storage policy checks.
 */
export async function preparePantryImageUpload(file: {
  filename: string;
  mediaType: string;
  size: number;
}): Promise<PantryImageTarget> {
  const check = validateProductImage({ size: file.size, mediaType: file.mediaType });
  if (!check.ok) return check;

  const result = await runHouseholdAction<PantryImageTarget>(async (_supabase, householdId) => ({
    ok: true,
    storagePath: buildProductImagePath(householdId, file.filename, crypto.randomUUID()),
  }));
  // runHouseholdAction widens to ActionResult for its own "not signed in" and
  // "request failed" cases, both of which are ok: false and pass through here.
  return "storagePath" in result
    ? result
    : { ok: false, message: "Couldn't start that upload — try again." };
}

/**
 * Step 2: record an uploaded photo against a pantry item.
 *
 * Writes to the household's own layer, never to catalog_products — that row is
 * shared by every household, and the unique index from 0027 would refuse the
 * second household to photograph the same product anyway. Your ketchup photo
 * beats the stock one on your Pantry and changes nothing for anyone else.
 */
export async function setPantryImage(item: {
  catalogProductId?: string | null;
  productId?: string | null;
  /** Carried so a preference row created here is labelled, not left blank. */
  title: string;
  storagePath: string;
}): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    // The browser hands this path back, so it is re-checked before it is
    // written anywhere it would be rendered. Storage RLS already refused a
    // write outside the household's folder; this stops an arbitrary string
    // becoming a product's image_url.
    if (!productImagePathBelongsToHousehold(item.storagePath, householdId)) {
      return { ok: false, message: "That photo couldn't be attached — try taking it again." };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return { ok: false, message: "Couldn't attach that photo — try again." };
    const imageUrl = productImagePublicUrl(supabaseUrl, item.storagePath);

    if (item.catalogProductId) {
      // Upsert rather than update: a pantry row can be catalogue-backed
      // without a preference row of its own yet, and photographing it is a
      // reasonable first thing to do to it. `label` is NOT NULL, so a row
      // created by this path has to carry one — on the update path the
      // conflict target keeps the label the household already chose.
      const { error } = await supabase.from("household_product_preferences").upsert(
        {
          household_id: householdId,
          scope_type: "product",
          scope_key: item.catalogProductId,
          label: item.title,
          image_url: imageUrl,
        },
        { onConflict: "household_id,scope_type,scope_key" },
      );
      if (error) return { ok: false, message: error.message };
    } else if (item.productId) {
      const { error } = await supabase
        .from("products")
        .update({ image_url: imageUrl })
        .eq("id", item.productId)
        .eq("household_id", householdId);
      if (error) return { ok: false, message: error.message };
    } else {
      return { ok: false, message: "Couldn't tell which item that photo belongs to." };
    }

    revalidatePath("/shop/pantry");
    revalidatePath("/shop/list");
    return { ok: true };
  });
}

/**
 * Star or unstar a pantry item.
 *
 * Regular-buy stopped distinguishing anything once the household's whole
 * library was in the pantry — 213 rows, all of them things they buy. A
 * favourite is the shorter list: what gets reached for most, pinned to the top
 * of Pantry and offered first when building a shop.
 */
export async function setFavourite(item: {
  catalogProductId?: string | null;
  productId?: string | null;
  title: string;
  favourite: boolean;
}): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    if (item.catalogProductId) {
      const { error } = await supabase.from("household_product_preferences").upsert(
        {
          household_id: householdId,
          scope_type: "product",
          scope_key: item.catalogProductId,
          label: item.title,
          is_favourite: item.favourite,
        },
        { onConflict: "household_id,scope_type,scope_key" },
      );
      if (error) return { ok: false, message: error.message };
    } else if (item.productId) {
      const { error } = await supabase
        .from("products")
        .update({ is_favourite: item.favourite })
        .eq("id", item.productId)
        .eq("household_id", householdId);
      if (error) return { ok: false, message: error.message };
    } else {
      return { ok: false, message: "Couldn't tell which item that was." };
    }

    revalidatePath("/shop/pantry");
    revalidatePath("/shop/list");
    return { ok: true };
  });
}
