import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAnthropicReceiptExtractor } from "@/lib/receipts/extractors/anthropic";
import { aliasKey, isProductLine, matchReceiptLine } from "@/lib/receipts/matching";
import { findDuplicateReceipt, hashDocument, type ExistingReceipt } from "@/lib/receipts/duplicate";
import { ReceiptExtractionError, type ReceiptExtractor } from "@/lib/receipts/types";
import type { MatchableCatalogProduct } from "@/lib/retailers/matching";

/**
 * Server-only receipt pipeline: upload -> extract -> match -> review -> verify.
 *
 * The invariant that governs this whole file: extraction produces a PROPOSAL.
 * Nothing becomes household purchase history or a price observation until a
 * person confirms it, which is why `verifyReceipt` is the only function that
 * writes to household_purchases or retailer_price_observations.
 */

/** Swappable provider (§5). Today there is one; the seam is what matters. */
export function getExtractor(): ReceiptExtractor {
  return createAnthropicReceiptExtractor();
}

export function isExtractionConfigured(): boolean {
  return getExtractor().isConfigured();
}

async function getCatalog(): Promise<MatchableCatalogProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalog_products")
    .select("id, display_name, brand, category, subcategory, search_aliases, default_unit")
    .eq("active", true);
  return (data ?? []) as unknown as MatchableCatalogProduct[];
}

/** Catalogue products this household actually buys — matching evidence. */
async function getHouseholdProductIds(householdId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_product_preferences")
    .select("scope_key")
    .eq("household_id", householdId)
    .eq("scope_type", "product");
  return new Set(((data ?? []) as { scope_key: string }[]).map((r) => r.scope_key));
}

async function resolveRetailerId(name: string | null): Promise<string | null> {
  if (!name) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("retailers").select("id, name");
  const rows = (data ?? []) as { id: string; name: string }[];
  const target = name.trim().toLowerCase();
  const exact = rows.find((r) => r.name.toLowerCase() === target);
  if (exact) return exact.id;
  // Receipts print "FORTINOS #123" or "NOFRILLS" — accept a containment match
  // in either direction, but never invent a retailer that doesn't exist.
  const loose = rows.find(
    (r) => target.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(target),
  );
  return loose?.id ?? null;
}

export type UploadOutcome =
  | { ok: true; receiptId: string; duplicateWarning: string | null }
  | { ok: false; message: string };

/**
 * Stores the file, then extracts and matches it.
 *
 * A receipt always lands in REVIEW_REQUIRED (or FAILED) — never VERIFIED —
 * because OCR completing is not the same as the household agreeing (§3).
 */
export async function ingestReceipt(
  householdId: string,
  file: { bytes: Uint8Array; mediaType: string; filename: string },
): Promise<UploadOutcome> {
  const supabase = await createClient();
  const documentHash = await hashDocument(file.bytes);

  // Duplicate check on the file itself, before anything is stored (§22).
  const { data: existingRows } = await supabase
    .from("receipts")
    .select("id, document_hash, purchased_at, total_cents, transaction_ref, retailer:retailers(name)")
    .eq("household_id", householdId);

  type ExistingRow = {
    id: string;
    document_hash: string | null;
    purchased_at: string | null;
    total_cents: number | null;
    transaction_ref: string | null;
    retailer: { name: string } | null;
  };
  const existing: ExistingReceipt[] = ((existingRows ?? []) as unknown as ExistingRow[]).map((r) => ({
    id: r.id,
    documentHash: r.document_hash,
    retailerName: r.retailer?.name ?? null,
    purchaseDate: r.purchased_at,
    totalCents: r.total_cents,
    transactionRef: r.transaction_ref,
  }));

  const exactDuplicate = findDuplicateReceipt(
    { documentHash, retailerName: null, purchaseDate: null, totalCents: null, transactionRef: null },
    existing,
  );
  if (exactDuplicate?.kind === "EXACT") {
    return { ok: false, message: exactDuplicate.reason };
  }

  // Household-scoped storage path — the RLS policy keys off this first segment.
  const storagePath = `${householdId}/${crypto.randomUUID()}-${file.filename}`;
  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(storagePath, file.bytes, { contentType: file.mediaType, upsert: false });
  if (uploadError) return { ok: false, message: uploadError.message };

  const { data: inserted, error: insertError } = await supabase
    .from("receipts")
    .insert({
      household_id: householdId,
      status: "PROCESSING",
      storage_path: storagePath,
      document_hash: documentHash,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return { ok: false, message: insertError?.message ?? "Couldn't save the receipt." };
  }
  const receiptId = (inserted as { id: string }).id;

  const extractor = getExtractor();
  if (!extractor.isConfigured()) {
    await supabase
      .from("receipts")
      .update({
        status: "UPLOADED",
        extraction_error:
          "Saved, but automatic reading isn't configured yet. Set ANTHROPIC_API_KEY to enable it.",
      })
      .eq("id", receiptId);
    return {
      ok: true,
      receiptId,
      duplicateWarning: null,
    };
  }

  try {
    const result = await extractor.extract(file);
    const [catalog, householdIds] = await Promise.all([getCatalog(), getHouseholdProductIds(householdId)]);
    const retailerId = await resolveRetailerId(result.retailerName);

    // Learned aliases are retailer-scoped: an abbreviation confirmed at one
    // store says nothing about the same string at another (§8).
    let aliases: { rawDescription: string; catalogProductId: string }[] = [];
    if (retailerId) {
      const { data: aliasRows } = await supabase
        .from("retailer_product_aliases")
        .select("raw_description, catalog_product_id")
        .eq("retailer_id", retailerId);
      aliases = ((aliasRows ?? []) as { raw_description: string; catalog_product_id: string }[]).map(
        (r) => ({ rawDescription: r.raw_description, catalogProductId: r.catalog_product_id }),
      );
    }

    const lines = result.items.map((item, index) => {
      const match = isProductLine(item.lineType)
        ? matchReceiptLine(item.rawDescription, catalog, { aliases, householdProductIds: householdIds })
        : {
            catalogProductId: null,
            confidence: 1,
            matchMethod: "not_a_product",
            status: "IGNORED" as const,
            reason: `${item.lineType} line.`,
          };
      return {
        receipt_id: receiptId,
        name: item.rawDescription,
        raw_description: item.rawDescription,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        line_total_cents: item.lineTotalCents,
        price_cents: item.lineTotalCents,
        discount_cents: item.discountCents,
        line_type: item.lineType,
        catalog_product_id: match.catalogProductId,
        match_status: match.status,
        match_confidence: match.confidence,
        match_method: match.matchMethod,
        sort_order: index,
      };
    });

    if (lines.length > 0) {
      await supabase.from("receipt_items").insert(lines);
    }

    const duplicate = findDuplicateReceipt(
      {
        documentHash,
        retailerName: result.retailerName,
        purchaseDate: result.purchaseDate,
        totalCents: result.totalCents,
        transactionRef: result.transactionRef,
      },
      existing,
    );

    await supabase
      .from("receipts")
      .update({
        status: "REVIEW_REQUIRED",
        retailer_id: retailerId,
        purchased_at: result.purchaseDate,
        purchased_time: result.purchaseTime,
        subtotal_cents: result.subtotalCents,
        tax_cents: result.taxCents,
        total_cents: result.totalCents,
        transaction_ref: result.transactionRef,
        raw_text: result.rawText,
        extractor: extractor.name,
        extraction_confidence: result.confidence,
        processed_at: new Date().toISOString(),
      })
      .eq("id", receiptId);

    return { ok: true, receiptId, duplicateWarning: duplicate ? duplicate.reason : null };
  } catch (err) {
    const message =
      err instanceof ReceiptExtractionError ? err.message : "Couldn't read that receipt.";
    await supabase
      .from("receipts")
      .update({ status: "FAILED", extraction_error: message, processed_at: new Date().toISOString() })
      .eq("id", receiptId);
    return { ok: true, receiptId, duplicateWarning: null };
  }
}

export type VerifyOutcome =
  | { ok: true; purchasesCreated: number; observationsCreated: number; aliasesLearned: number }
  | { ok: false; message: string };

/**
 * Turns a reviewed receipt into real household history.
 *
 * This is the ONLY place purchase history and receipt-sourced price
 * observations are written, and it refuses to run on anything but a receipt
 * the household has actually reviewed.
 */
export async function verifyReceipt(householdId: string, receiptId: string): Promise<VerifyOutcome> {
  const supabase = await createClient();

  const { data: receiptRow } = await supabase
    .from("receipts")
    .select("id, household_id, status, retailer_id, retailer_location_id, purchased_at")
    .eq("id", receiptId)
    .eq("household_id", householdId)
    .maybeSingle();

  type ReceiptRow = {
    id: string;
    status: string;
    retailer_id: string | null;
    retailer_location_id: string | null;
    purchased_at: string | null;
  };
  const receipt = receiptRow as ReceiptRow | null;
  if (!receipt) return { ok: false, message: "Receipt not found." };
  if (receipt.status === "VERIFIED") return { ok: false, message: "This receipt is already verified." };
  if (!receipt.purchased_at) {
    return { ok: false, message: "Set the purchase date before verifying — it anchors the price history." };
  }

  const { data: itemRows } = await supabase
    .from("receipt_items")
    .select(
      "id, raw_description, catalog_product_id, quantity, unit_price_cents, line_total_cents, discount_cents, line_type, match_status",
    )
    .eq("receipt_id", receiptId);

  type ItemRow = {
    id: string;
    raw_description: string | null;
    catalog_product_id: string | null;
    quantity: number | null;
    unit_price_cents: number | null;
    line_total_cents: number | null;
    discount_cents: number | null;
    line_type: string;
    match_status: string;
  };
  const items = (itemRows ?? []) as ItemRow[];

  // Only real product lines that resolved to a catalogue product and carry a
  // price become history. Ignored, unmatched, tax and discount lines don't.
  const usable = items.filter(
    (i) =>
      isProductLine(i.line_type) &&
      i.match_status !== "IGNORED" &&
      i.catalog_product_id !== null &&
      i.line_total_cents !== null,
  );

  let purchasesCreated = 0;
  let observationsCreated = 0;
  let aliasesLearned = 0;

  if (usable.length > 0) {
    const { error: purchaseError } = await supabase.from("household_purchases").insert(
      usable.map((i) => ({
        household_id: householdId,
        receipt_id: receiptId,
        receipt_item_id: i.id,
        catalog_product_id: i.catalog_product_id,
        retailer_id: receipt.retailer_id,
        retailer_location_id: receipt.retailer_location_id,
        purchase_date: receipt.purchased_at!,
        quantity: i.quantity,
        unit_price_cents: i.unit_price_cents,
        line_total_cents: i.line_total_cents!,
        discount_cents: i.discount_cents,
      })),
    );
    if (purchaseError) return { ok: false, message: purchaseError.message };
    purchasesCreated = usable.length;

    // Price observations, explicitly sourced as RECEIPT: a price actually
    // PAID on a past date, never presented as today's shelf price (§10, §17).
    const receiptRetailerId = receipt.retailer_id;
    if (receiptRetailerId) {
      const observedAt = new Date(`${receipt.purchased_at}T12:00:00Z`).toISOString();
      const { error: obsError } = await supabase.from("retailer_price_observations").upsert(
        usable.map((i) => ({
          household_id: householdId,
          receipt_id: receiptId,
          catalog_product_id: i.catalog_product_id,
          retailer_id: receiptRetailerId,
          retailer_location_id: receipt.retailer_location_id,
          // Unit price when the receipt gave one; otherwise the line total,
          // which is only equal to unit price when quantity is 1.
          observed_price_cents:
            i.unit_price_cents ?? (i.quantity === null || i.quantity === 1 ? i.line_total_cents! : i.line_total_cents!),
          source_type: "RECEIPT",
          match_status: "MATCHED",
          raw_name: i.raw_description,
          observed_at: observedAt,
        })),
        { ignoreDuplicates: true },
      );
      if (!obsError) observationsCreated = usable.length;
    }

    // Learn the abbreviations the household just confirmed (§8).
    if (receiptRetailerId) {
      const aliasRows = usable
        .filter((i) => i.raw_description)
        .map((i) => ({
          retailer_id: receiptRetailerId,
          raw_description: aliasKey(i.raw_description!),
          catalog_product_id: i.catalog_product_id!,
          confirmed_by_user: true,
          last_seen_at: new Date().toISOString(),
        }));
      if (aliasRows.length > 0) {
        const { error: aliasError } = await supabase
          .from("retailer_product_aliases")
          .upsert(aliasRows, { onConflict: "retailer_id,raw_description" });
        if (!aliasError) aliasesLearned = aliasRows.length;
      }
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("receipts")
    .update({ status: "VERIFIED", verified_at: new Date().toISOString(), verified_by: user?.id ?? null })
    .eq("id", receiptId);

  return { ok: true, purchasesCreated, observationsCreated, aliasesLearned };
}
