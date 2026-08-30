import {
  type ReceiptExtractionResult,
  type ReceiptLineType,
} from "./types";

/**
 * Pure coercion of a provider payload into the shared result shape.
 *
 * Split out from the network client on purpose: this is the part that must be
 * exhaustively tested against fixture receipts, and it must stay importable
 * without pulling in `server-only` or an SDK.
 */
const LINE_TYPES: ReceiptLineType[] = ["ITEM", "DISCOUNT", "TAX", "SUBTOTAL", "TOTAL", "UNKNOWN"];

function asIntOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}
function asNumOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function asStrOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function clamp01(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Coerces a provider payload into the shared result shape. Exported so the
 * same normalization is covered by fixture tests without any network call.
 */
export function normalizeExtraction(parsed: Record<string, unknown>): ReceiptExtractionResult {
  const rawItems = Array.isArray(parsed.items) ? (parsed.items as Record<string, unknown>[]) : [];
  return {
    retailerName: asStrOrNull(parsed.retailerName),
    storeAddress: asStrOrNull(parsed.storeAddress),
    purchaseDate: asStrOrNull(parsed.purchaseDate),
    purchaseTime: asStrOrNull(parsed.purchaseTime),
    subtotalCents: asIntOrNull(parsed.subtotalCents),
    taxCents: asIntOrNull(parsed.taxCents),
    totalCents: asIntOrNull(parsed.totalCents),
    transactionRef: asStrOrNull(parsed.transactionRef),
    rawText: typeof parsed.rawText === "string" ? parsed.rawText : "",
    confidence: clamp01(parsed.confidence),
    items: rawItems
      .map((item) => ({
        rawDescription: asStrOrNull(item.rawDescription) ?? "",
        quantity: asNumOrNull(item.quantity),
        unitPriceCents: asIntOrNull(item.unitPriceCents),
        lineTotalCents: asIntOrNull(item.lineTotalCents),
        discountCents: asIntOrNull(item.discountCents),
        lineType: LINE_TYPES.includes(item.lineType as ReceiptLineType)
          ? (item.lineType as ReceiptLineType)
          : "UNKNOWN",
        confidence: clamp01(item.confidence),
      }))
      .filter((item) => item.rawDescription.length > 0),
  };
}
