"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { isBrandRigidity } from "@/lib/household/regular-buys";

const TOUCHED = ["/shop/regular-buys", "/shop/browse", "/shop/pantry", "/shop/list", "/home"];

function revalidateAll() {
  for (const path of TOUCHED) revalidatePath(path);
}

/**
 * Tags or untags a catalogue product as something this household buys.
 *
 * Untagging clears the flag rather than deleting the row, so a brand
 * preference set months ago survives being taken off the list and comes back
 * intact if the product is tagged again.
 */
export async function setRegularBuy(
  catalogProductId: string,
  label: string,
  on: boolean,
): Promise<ActionResult> {
  if (!catalogProductId) return { ok: false, message: "Pick a product first." };

  return runHouseholdAction(async (supabase, householdId) => {
    if (on) {
      // Only the columns named here are written, so preferred_brand and
      // brand_rigidity on an existing row are left alone.
      const { error } = await supabase.from("household_product_preferences").upsert(
        {
          household_id: householdId,
          scope_type: "product",
          scope_key: catalogProductId,
          label: label.trim() || catalogProductId,
          regular_buy: true,
        },
        { onConflict: "household_id,scope_type,scope_key" },
      );
      if (error) return { ok: false, message: error.message };
    } else {
      const { error } = await supabase
        .from("household_product_preferences")
        .update({ regular_buy: false })
        .eq("household_id", householdId)
        .eq("scope_type", "product")
        .eq("scope_key", catalogProductId);
      if (error) return { ok: false, message: error.message };
    }

    revalidateAll();
    return { ok: true };
  });
}

/**
 * Sets which brand the household wants for a regular buy, and how strictly.
 *
 * This is the half that makes a deal useful: the catalogue concept is what a
 * flyer matches, and this decides whether the brand on offer counts.
 */
export async function setBrandPreference(
  catalogProductId: string,
  input: { preferredBrand: string | null; brandRigidity: string },
): Promise<ActionResult> {
  if (!catalogProductId) return { ok: false, message: "Pick a product first." };
  if (!isBrandRigidity(input.brandRigidity)) {
    return { ok: false, message: "Choose how strict the brand should be." };
  }

  const brand = input.preferredBrand?.trim() || null;
  if (!brand && input.brandRigidity !== "FLEXIBLE") {
    return { ok: false, message: "Name the brand, or choose “Any brand”." };
  }

  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("household_product_preferences")
      .update({ preferred_brand: brand, brand_rigidity: input.brandRigidity })
      .eq("household_id", householdId)
      .eq("scope_type", "product")
      .eq("scope_key", catalogProductId);
    if (error) return { ok: false, message: error.message };

    revalidateAll();
    return { ok: true };
  });
}

/**
 * Untag a household-owned SKU as a regular buy.
 *
 * setRegularBuy writes to the preference layer, which is right for a
 * catalogue-backed row and wrong for one of the household's own branded
 * products: it would leave `products.is_regular_buy` true and quietly create
 * an unrelated preference row, so the item would still be there after a
 * refresh.
 */
export async function setProductRegularBuy(productId: string, on: boolean): Promise<ActionResult> {
  if (!productId) return { ok: false, message: "Pick a product first." };

  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("products")
      .update({ is_regular_buy: on })
      .eq("id", productId)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };

    revalidateAll();
    return { ok: true };
  });
}
