"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";

export type WatchDraft = {
  name: string;
  category: string;
  dept: string;
  retailer: string;
  current: string;
  target: string;
  needBy: string;
  notes: string;
  athleteId: string;
  size: string;
  fit: string;
  catalogProductId?: string;
};

export type OwnDraft = {
  name: string;
  category: string;
  dept: string;
  retailer: string;
  purchasePrice: string;
  purchaseDate: string;
  warrantyUntil: string;
  catalogProductId?: string;
};

async function resolveRetailerId(supabase: SupabaseClient, name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data } = await supabase.from("retailers").select("id").ilike("name", trimmed).maybeSingle();
  return data?.id ?? null;
}

export async function submitAddWatch(draft: WatchDraft): Promise<ActionResult> {
  if (!draft.name.trim()) return { ok: false, message: "Add a product name." };

  return runHouseholdAction(async (supabase, householdId) => {
    const retailerId = await resolveRetailerId(supabase, draft.retailer);

    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        household_id: householdId,
        title: draft.name.trim(),
        retailer_id: retailerId,
        department_key: draft.dept || null,
        catalog_product_id: draft.catalogProductId || null,
      })
      .select("id")
      .single();
    if (productError || !product) return { ok: false, message: productError?.message ?? "Couldn't save." };

    const current = draft.current ? Math.round(parseFloat(draft.current) * 100) : null;
    const target = draft.target ? Math.round(parseFloat(draft.target) * 100) : current;
    const category = [draft.category, [draft.size && `Size ${draft.size}`, draft.fit && `Fit ${draft.fit}`].filter(Boolean).join(" · ")]
      .filter(Boolean)
      .join(" · ");

    const { error: watchError } = await supabase.from("watch_items").insert({
      household_id: householdId,
      product_id: product.id,
      category: category || null,
      target_price_cents: target,
      regular_price_cents: current,
      needed_by: draft.needBy || null,
      notes: draft.notes || null,
      athlete_id: draft.athleteId || null,
    });
    if (watchError) return { ok: false, message: watchError.message };

    if (current != null) {
      await supabase.from("price_snapshots").insert({
        product_id: product.id,
        retailer_id: retailerId,
        price_cents: current,
        source: "manual",
      });
    }

    revalidatePath("/watch");
    revalidatePath("/rooms");
    revalidatePath("/home");
    return { ok: true };
  });
}

export async function submitAddOwned(draft: OwnDraft): Promise<ActionResult> {
  if (!draft.name.trim()) return { ok: false, message: "Add a product name." };

  return runHouseholdAction(async (supabase, householdId) => {
    const retailerId = await resolveRetailerId(supabase, draft.retailer);

    const { data: product } = await supabase
      .from("products")
      .insert({
        household_id: householdId,
        title: draft.name.trim(),
        retailer_id: retailerId,
        department_key: draft.dept || null,
        catalog_product_id: draft.catalogProductId || null,
      })
      .select("id")
      .single();

    const purchasePrice = draft.purchasePrice ? Math.round(parseFloat(draft.purchasePrice) * 100) : null;

    const { error } = await supabase.from("owned_products").insert({
      household_id: householdId,
      product_id: product?.id ?? null,
      name: draft.name.trim(),
      department_key: draft.dept || null,
      retailer_id: retailerId,
      purchase_price_cents: purchasePrice,
      purchase_date: draft.purchaseDate || null,
      warranty_until: draft.warrantyUntil || null,
    });
    if (error) return { ok: false, message: error.message };

    revalidatePath("/rooms");
    return { ok: true };
  });
}

export type SpecDraft = { title: string; brands: string; requirements: string; maxPrice: string };

export async function submitAddSpec(draft: SpecDraft): Promise<ActionResult> {
  if (!draft.title.trim()) return { ok: false, message: "Describe what you're looking for." };

  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase.from("watch_specs").insert({
      household_id: householdId,
      title: draft.title.trim(),
      brands: draft.brands || null,
      requirements: draft.requirements || null,
      max_price_cents: draft.maxPrice ? Math.round(parseFloat(draft.maxPrice) * 100) : null,
    });
    if (error) return { ok: false, message: error.message };
    revalidatePath("/watch");
    return { ok: true };
  });
}

export async function markWatchItemPurchased(watchItemId: string): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { data: item } = await supabase
      .from("watch_items")
      .select("id, product:products(id, title, department_key, retailer_id)")
      .eq("id", watchItemId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (!item) return { ok: false, message: "Couldn't find that item." };

    type Row = { product: { id: string; title: string; department_key: string | null; retailer_id: string | null } | null };
    const product = (item as unknown as Row).product;

    const { error: insertError } = await supabase.from("owned_products").insert({
      household_id: householdId,
      product_id: product?.id ?? null,
      name: product?.title ?? "Purchased item",
      department_key: product?.department_key ?? null,
      retailer_id: product?.retailer_id ?? null,
      purchase_date: new Date().toISOString().slice(0, 10),
    });
    if (insertError) return { ok: false, message: insertError.message };

    const { error: updateError } = await supabase
      .from("watch_items")
      .update({ status: "archived" })
      .eq("id", watchItemId)
      .eq("household_id", householdId);
    if (updateError) return { ok: false, message: updateError.message };

    revalidatePath("/watch");
    revalidatePath("/rooms");
    return { ok: true };
  });
}
