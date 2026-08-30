"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { ingestStoredReceipt, receiptUploadTarget, verifyReceipt } from "@/lib/data/receipt-pipeline";
import { validateReceiptUpload } from "@/lib/receipts/upload";
import { addHouseholdNeed } from "@/app/(shell)/shop/pantry/actions";

export type UploadResult = ActionResult & { receiptId?: string; duplicateWarning?: string | null };

export type UploadTargetResult = { ok: true; storagePath: string } | { ok: false; message: string };

/**
 * Step 1 of an upload: hand the browser the single path it may write to.
 *
 * The photo itself never passes through a Server Action. A Vercel Function
 * rejects any request body over 4.5 MB with a 413 — a limit no Next.js
 * `bodySizeLimit` setting can raise — and a phone receipt photo is routinely
 * larger than that. The browser uploads to private Storage under its own
 * session instead, so only this path and the tiny reference in step 2 cross a
 * Server Action.
 */
export async function prepareReceiptUpload(file: {
  filename: string;
  mediaType: string;
  size: number;
}): Promise<UploadTargetResult> {
  const check = validateReceiptUpload({ size: file.size, mediaType: file.mediaType });
  if (!check.ok) return check;

  const result = await runHouseholdAction<UploadTargetResult>(async (_supabase, householdId) => ({
    ok: true,
    storagePath: receiptUploadTarget(householdId, file.filename),
  }));
  if (!result.ok) return result;
  // runHouseholdAction widens to ActionResult for its own "not signed in" and
  // "request failed" cases, both of which are ok: false and returned above.
  return "storagePath" in result
    ? result
    : { ok: false, message: "Couldn't start that upload — try again." };
}

/**
 * Step 2: read the uploaded object and run it through the existing pipeline.
 * Extraction stays server-side; the payload here is a path, not an image.
 * Always lands in review — never auto-verified (§3).
 */
export async function ingestUploadedReceipt(upload: {
  storagePath: string;
  mediaType: string;
  filename: string;
}): Promise<UploadResult> {
  return runHouseholdAction<UploadResult>(async (_supabase, householdId) => {
    const outcome = await ingestStoredReceipt(householdId, upload);
    if (!outcome.ok) return { ok: false, message: outcome.message };

    revalidatePath("/receipts");
    return { ok: true, receiptId: outcome.receiptId, duplicateWarning: outcome.duplicateWarning };
  });
}

/** Accept/change/ignore one reviewed line. Confirming is what makes it trusted. */
export async function updateReceiptLine(
  receiptId: string,
  lineId: string,
  update: { catalogProductId?: string | null; ignore?: boolean },
): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { data: receipt } = await supabase
      .from("receipts")
      .select("id")
      .eq("id", receiptId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (!receipt) return { ok: false, message: "Receipt not found." };

    const patch = update.ignore
      ? { match_status: "IGNORED" as const, confirmed_by_user: true }
      : {
          catalog_product_id: update.catalogProductId ?? null,
          match_status: update.catalogProductId ? ("MATCHED" as const) : ("UNMATCHED" as const),
          confirmed_by_user: true,
        };

    const { error } = await supabase.from("receipt_items").update(patch).eq("id", lineId).eq("receipt_id", receiptId);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/receipts/${receiptId}`);
    return { ok: true };
  });
}

/** Set header fields the extractor couldn't read (or read wrong). */
export async function updateReceiptHeader(
  receiptId: string,
  update: { purchasedAt?: string | null; totalCents?: number | null },
): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const patch: { purchased_at?: string | null; total_cents?: number | null } = {};
    if (update.purchasedAt !== undefined) patch.purchased_at = update.purchasedAt;
    if (update.totalCents !== undefined) patch.total_cents = update.totalCents;

    const { error } = await supabase
      .from("receipts")
      .update(patch)
      .eq("id", receiptId)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/receipts/${receiptId}`);
    return { ok: true };
  });
}

export type VerifyResult = ActionResult & {
  purchasesCreated?: number;
  observationsCreated?: number;
};

/** Confirm the receipt — the only path to real purchase history. */
export async function confirmReceipt(receiptId: string): Promise<VerifyResult> {
  return runHouseholdAction<VerifyResult>(async (_supabase, householdId) => {
    const outcome = await verifyReceipt(householdId, receiptId);
    if (!outcome.ok) return { ok: false, message: outcome.message };
    revalidatePath("/receipts");
    revalidatePath(`/receipts/${receiptId}`);
    revalidatePath("/shop/pantry");
    revalidatePath("/home");
    return {
      ok: true,
      purchasesCreated: outcome.purchasesCreated,
      observationsCreated: outcome.observationsCreated,
    };
  });
}

/**
 * Post-verification pantry assist (§13). Explicitly a per-item confirmation:
 * buying something doesn't prove it's stocked now, so nothing is auto-marked.
 */
export async function markPurchasedInStock(catalogProductIds: string[]): Promise<ActionResult> {
  if (catalogProductIds.length === 0) return { ok: true };
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase.from("household_inventory_state").upsert(
      catalogProductIds.map((id) => ({
        household_id: householdId,
        catalog_product_id: id,
        status: "IN_STOCK",
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "household_id,catalog_product_id" },
    );
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/pantry");
    revalidatePath("/home");
    return { ok: true };
  });
}

/**
 * Shopping-list reconciliation (§14). Only ticks off items actually purchased;
 * never deletes a need the receipt didn't cover.
 */
export async function markPurchasedOnList(catalogProductIds: string[]): Promise<ActionResult> {
  if (catalogProductIds.length === 0) return { ok: true };
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("grocery_items")
      .update({ checked: true })
      .eq("household_id", householdId)
      .eq("checked", false)
      .in("catalog_product_id", catalogProductIds);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/shop/list");
    revalidatePath("/home");
    return { ok: true };
  });
}

/** Manual price entry (§15) — a legitimate, human-sourced observation. */
export async function addManualPrice(input: {
  catalogProductId: string;
  retailerId: string;
  priceCents: number;
  regularPriceCents?: number | null;
  packageSize?: string | null;
  observedOn?: string | null;
  note?: string | null;
}): Promise<ActionResult> {
  if (!Number.isFinite(input.priceCents) || input.priceCents <= 0) {
    return { ok: false, message: "Enter a price." };
  }
  return runHouseholdAction(async (supabase, householdId) => {
    const observedAt = input.observedOn
      ? new Date(`${input.observedOn}T12:00:00Z`).toISOString()
      : new Date().toISOString();

    const { error } = await supabase.from("retailer_price_observations").upsert(
      {
        household_id: householdId,
        catalog_product_id: input.catalogProductId,
        retailer_id: input.retailerId,
        observed_price_cents: input.priceCents,
        regular_price_cents: input.regularPriceCents ?? null,
        package_size: input.packageSize ?? null,
        promotion_text: input.note ?? null,
        source_type: "MANUAL",
        match_status: "MATCHED",
        match_confidence: 1,
        match_method: "manual_entry",
        observed_at: observedAt,
      },
      { ignoreDuplicates: true },
    );
    if (error) return { ok: false, message: error.message };
    revalidatePath("/price-history");
    revalidatePath("/shop/list");
    revalidatePath("/home");
    return { ok: true };
  });
}

/** Re-add a purchased item to the list (e.g. wrong size bought). */
export async function reAddNeed(catalogProductId: string, name: string): Promise<ActionResult> {
  return addHouseholdNeed({ catalogProductId, name, source: "RECEIPT" });
}
