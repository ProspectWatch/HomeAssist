"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { resolveNeedMatch, type ActiveListItem, type NeedSource } from "@/lib/household/needs";
import { getPriceSightings } from "@/lib/data/price-book";
import type { ListItemCheck, StoreSighting } from "@/lib/shopping/list-check";

export async function addGroceryItem(
  name: string,
  options?: { catalogProductId?: string | null; category?: string | null },
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Type something to add first." };

  return runHouseholdAction(async (supabase, householdId) => {
    // Arrives tagged with the store this household always buys it from, if
    // they have said so.
    let retailerId: string | null = null;
    if (options?.catalogProductId) {
      const { data: pref } = await supabase
        .from("household_product_preferences")
        .select("preferred_retailer_id")
        .eq("household_id", householdId)
        .eq("scope_type", "product")
        .eq("scope_key", options.catalogProductId)
        .maybeSingle();
      retailerId = pref?.preferred_retailer_id ?? null;
    }

    const { error } = await supabase.from("grocery_items").insert({
      household_id: householdId,
      name: trimmed,
      catalog_product_id: options?.catalogProductId ?? null,
      retailer_id: retailerId,
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

    // Where the household has said which store it buys something from, the
    // new line arrives already tagged. That is the whole point of tagging it
    // once rather than every week.
    const { data: prefRows } = await supabase
      .from("household_product_preferences")
      .select("scope_key, preferred_retailer_id")
      .eq("household_id", householdId)
      .eq("scope_type", "product")
      .not("preferred_retailer_id", "is", null);
    const storeByProduct = new Map(
      ((prefRows ?? []) as { scope_key: string; preferred_retailer_id: string | null }[]).map(
        (r) => [r.scope_key, r.preferred_retailer_id],
      ),
    );

    const toInsert: {
      household_id: string;
      name: string;
      qty: string | null;
      catalog_product_id: string | null;
      retailer_id: string | null;
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
        retailer_id: need.catalogProductId
          ? (storeByProduct.get(need.catalogProductId) ?? null)
          : null,
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

/**
 * Records which flavours we want of one line on the list.
 *
 * Only a per-trip choice: it writes to this row and nowhere else. Promoting it
 * to household_product_preferences.preferred_variant would turn "Sweet Chili
 * Heat this week" into a standing preference and mislabel every future list.
 */
export async function setGroceryItemVariants(
  id: string,
  variants: string[],
): Promise<ActionResult> {
  const cleaned = [...new Set(variants.map((v) => v.trim()).filter(Boolean))].slice(0, 8);

  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("grocery_items")
      .update({ variants: cleaned })
      .eq("id", id)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/list");
    return { ok: true };
  });
}

export type StoreTagStrength = "ALWAYS" | "SOMETIMES" | null;

/**
 * Records which store the household buys something from.
 *
 * Two writes, deliberately, because there are two different facts here.
 *
 * The line gets `retailer_id`, so the badge is right on this trip. That alone
 * would be forgotten the moment the item is ticked off and added again next
 * week, which is not what "we always get steak at Marilu's" means.
 *
 * So where the line is backed by a catalogue product, the standing preference
 * is written too: preferred_retailer_id for always, acceptable_stores for the
 * occasional one. That is what makes the tag survive the trip, and it is read
 * back when the item is next added so it arrives already tagged.
 *
 * A line typed by hand has no catalogue product to hang a preference on, so it
 * gets the badge for this trip only. Saying otherwise would be a promise the
 * data cannot keep.
 */
export async function setGroceryItemStore(
  itemId: string,
  retailerId: string | null,
  strength: StoreTagStrength,
): Promise<ActionResult & { remembered?: boolean }> {
  return runHouseholdAction<ActionResult & { remembered?: boolean }>(
    async (supabase, householdId) => {
      const { data: item, error: readError } = await supabase
        .from("grocery_items")
        .select("id, catalog_product_id")
        .eq("id", itemId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (readError) return { ok: false, message: readError.message };
      if (!item) return { ok: false, message: "That item is no longer on the list." };

      const { error } = await supabase
        .from("grocery_items")
        .update({ retailer_id: retailerId })
        .eq("id", itemId)
        .eq("household_id", householdId);
      if (error) return { ok: false, message: error.message };

      let remembered = false;
      if (item.catalog_product_id && retailerId && strength) {
        const { data: retailer } = await supabase
          .from("retailers")
          .select("name")
          .eq("id", retailerId)
          .maybeSingle();

        const { data: existing } = await supabase
          .from("household_product_preferences")
          .select("id, acceptable_stores")
          .eq("household_id", householdId)
          .eq("scope_type", "product")
          .eq("scope_key", item.catalog_product_id)
          .maybeSingle();

        if (strength === "ALWAYS") {
          const patch = {
            preferred_retailer_id: retailerId,
            preferred_store: retailer?.name ?? null,
          };
          const { error: prefError } = existing
            ? await supabase
                .from("household_product_preferences")
                .update(patch)
                .eq("id", existing.id)
            : await supabase.from("household_product_preferences").insert({
                household_id: householdId,
                scope_type: "product",
                scope_key: item.catalog_product_id,
                label: "",
                ...patch,
              });
          if (prefError) return { ok: false, message: prefError.message };
          remembered = true;
        } else if (existing && retailer?.name) {
          // "Once in a while Costco" is a second acceptable store, not a
          // replacement for the one they always use.
          const stores = new Set(existing.acceptable_stores ?? []);
          stores.add(retailer.name);
          const { error: prefError } = await supabase
            .from("household_product_preferences")
            .update({ acceptable_stores: [...stores] })
            .eq("id", existing.id);
          if (prefError) return { ok: false, message: prefError.message };
          remembered = true;
        }
      }

      revalidatePath("/shop/list");
      return { ok: true, remembered };
    },
  );
}

export type ListCheckResult =
  | { ok: true; checks: ListItemCheck[]; today: string }
  | { ok: false; message: string };

/**
 * Checks the list against the stores, on demand.
 *
 * Reads the price book rather than going out to the shops: those prices are
 * what the sweeps have already collected, and asking six retailers for sixty
 * items while somebody waits is neither fast nor polite. The freshness of each
 * one is carried through so a fortnight-old price is not passed off as today's.
 */
export async function checkListAgainstStores(): Promise<ListCheckResult> {
  const result = await runHouseholdAction<ListCheckResult>(async (supabase, householdId) => {
    const [{ data: rows }, book, { data: retailerRows }] = await Promise.all([
      supabase
        .from("grocery_items")
        .select("id, name, catalog_product_id, retailer_id")
        .eq("household_id", householdId)
        .eq("checked", false)
        .order("created_at", { ascending: true }),
      getPriceSightings(householdId),
      supabase.from("retailers").select("id, name"),
    ]);

    const retailerName = new Map(
      ((retailerRows ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]),
    );

    // Cheapest recorded price per (product, store). Keyed by store name
    // because that is what a sighting carries; the id is looked up after.
    const idByName = new Map(
      ((retailerRows ?? []) as { id: string; name: string }[]).map((r) => [r.name, r.id]),
    );
    const byProduct = new Map<string, Map<string, StoreSighting>>();
    for (const sighting of book) {
      if (!sighting.retailerName) continue;
      const stores =
        byProduct.get(sighting.catalogProductId) ?? new Map<string, StoreSighting>();
      const held = stores.get(sighting.retailerName);
      if (!held || sighting.priceCents < held.priceCents) {
        stores.set(sighting.retailerName, {
          retailerId: idByName.get(sighting.retailerName) ?? sighting.retailerName,
          retailerName: sighting.retailerName,
          priceCents: sighting.priceCents,
          seenOn: sighting.observedOn,
        });
      }
      byProduct.set(sighting.catalogProductId, stores);
    }

    const checks: ListItemCheck[] = (
      (rows ?? []) as {
        id: string;
        name: string;
        catalog_product_id: string | null;
        retailer_id: string | null;
      }[]
    ).map((row) => {
      const stores = row.catalog_product_id ? byProduct.get(row.catalog_product_id) : undefined;
      const sightings = [...(stores?.values() ?? [])].sort((a, b) => a.priceCents - b.priceCents);
      const taggedName = row.retailer_id ? (retailerName.get(row.retailer_id) ?? null) : null;
      return {
        itemId: row.id,
        name: row.name,
        taggedRetailerId: row.retailer_id,
        taggedRetailerName: taggedName,
        sightings,
        cheapest: sightings[0] ?? null,
        atTagged: taggedName ? (sightings.find((s) => s.retailerName === taggedName) ?? null) : null,
      };
    });

    return { ok: true, checks, today: new Date().toISOString().slice(0, 10) };
  });

  return "checks" in result ? result : { ok: false, message: result.ok ? "Couldn't check the list." : result.message };
}
