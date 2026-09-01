"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { importProductFromUrl } from "@/lib/products/fetch-product-page";
import type { ImportedProduct } from "@/lib/products/link-import";
import { OCCASIONS, type Occasion } from "@/lib/wish/model";

export type ProductLookupResult =
  | { ok: true; product: ImportedProduct }
  | { ok: false; message: string };

/**
 * Reads a product off a shop's page so a wish can carry its picture and price.
 *
 * Returns it for review rather than saving: an import is a reading of somebody
 * else's page and can be partial or wrong, and the thing being built is a list
 * somebody will spend money from.
 */
export async function lookUpProductLink(url: string): Promise<ProductLookupResult> {
  if (!url.trim()) return { ok: false, message: "Paste a link to the product first." };
  // Behind the household check so this cannot be used as an open URL fetcher.
  const guarded = await runHouseholdAction<ProductLookupResult>(async () => {
    return importProductFromUrl(url);
  });
  if ("product" in guarded) return guarded;
  // runHouseholdAction widens to ActionResult for its own "not signed in" and
  // "request failed" cases; both are ok: false and pass through here.
  return guarded.ok
    ? { ok: false, message: "Couldn't read that link — try again." }
    : { ok: false, message: guarded.message };
}

function isOccasion(value: string): value is Occasion {
  return (OCCASIONS as readonly string[]).includes(value);
}

export async function addWishItem(input: {
  personId: string | null;
  title: string;
  occasion: string;
  priority: number;
  notes: string | null;
  imageUrl: string | null;
  offer: { url: string; siteName: string | null; priceCents: number | null; currency: string | null; brand: string | null } | null;
}): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, message: "Give it a name." };

  return runHouseholdAction(async (supabase, householdId) => {
    const { data: item, error } = await supabase
      .from("wish_list_items")
      .insert({
        household_id: householdId,
        person_id: input.personId,
        title: title.slice(0, 200),
        occasion: isOccasion(input.occasion) ? input.occasion : "ANYTIME",
        priority: Math.min(3, Math.max(1, Math.round(input.priority))),
        notes: input.notes?.trim() || null,
        image_url: input.imageUrl,
      })
      .select("id")
      .single();
    if (error || !item) return { ok: false, message: error?.message ?? "Couldn't save that." };

    if (input.offer) {
      const { error: offerError } = await supabase.from("wish_list_offers").insert({
        item_id: item.id,
        household_id: householdId,
        url: input.offer.url,
        site_name: input.offer.siteName,
        price_cents: input.offer.priceCents,
        currency: input.offer.currency,
        brand: input.offer.brand,
        image_url: input.imageUrl,
      });
      // The wish is saved and useful without the link; losing the link is
      // worth reporting but not worth throwing the wish away over.
      if (offerError) return { ok: false, message: `Saved, but the link didn't attach: ${offerError.message}` };
    }

    revalidatePath("/wish");
    return { ok: true };
  });
}

/** Adds another shop to an existing wish — this is what "compare" means here. */
export async function addWishOffer(input: {
  itemId: string;
  url: string;
  siteName: string | null;
  priceCents: number | null;
  currency: string | null;
  brand: string | null;
}): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase.from("wish_list_offers").insert({
      item_id: input.itemId,
      household_id: householdId,
      url: input.url,
      site_name: input.siteName,
      price_cents: input.priceCents,
      currency: input.currency,
      brand: input.brand,
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/wish");
    return { ok: true };
  });
}

export async function setWishItemStatus(id: string, status: "WANTED" | "GOT_IT"): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("wish_list_items")
      .update({ status })
      .eq("id", id)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/wish");
    return { ok: true };
  });
}

export async function removeWishItem(id: string): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("wish_list_items")
      .delete()
      .eq("id", id)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/wish");
    return { ok: true };
  });
}
