/**
 * Receipt extraction contracts.
 *
 * Deliberately vendor-neutral: HomeAssist talks to an extractor through this
 * interface only, so swapping or adding an OCR provider is a new file, not a
 * rewrite. Nothing here decides household truth — extraction produces a
 * proposal that a person confirms.
 */

export type ReceiptStatus = "UPLOADED" | "PROCESSING" | "REVIEW_REQUIRED" | "VERIFIED" | "FAILED";

export type ReceiptLineType = "ITEM" | "DISCOUNT" | "TAX" | "SUBTOTAL" | "TOTAL" | "UNKNOWN";

export type ReceiptMatchStatus =
  | "MATCHED"
  | "LIKELY_MATCH"
  | "REVIEW_REQUIRED"
  | "UNMATCHED"
  | "IGNORED";

/** One line as the extractor read it. Absent values stay null — never inferred. */
export type ExtractedReceiptItem = {
  rawDescription: string;
  /** Null when the receipt didn't state a quantity. Never defaulted to 1 (§9). */
  quantity: number | null;
  unitPriceCents: number | null;
  lineTotalCents: number | null;
  discountCents: number | null;
  lineType: ReceiptLineType;
  /** 0..1 — the extractor's own confidence in reading this line. */
  confidence: number;
};

export type ReceiptExtractionResult = {
  retailerName: string | null;
  storeAddress: string | null;
  /** ISO date (YYYY-MM-DD). Null when not legible. */
  purchaseDate: string | null;
  purchaseTime: string | null;
  subtotalCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  transactionRef: string | null;
  items: ExtractedReceiptItem[];
  /** Full text the extractor read, kept for review and debugging (§4). */
  rawText: string;
  /** 0..1 overall confidence. */
  confidence: number;
};

export type ExtractorFailureReason =
  | "NOT_CONFIGURED"
  | "UNSUPPORTED_FORMAT"
  | "UNREADABLE"
  | "PROVIDER_ERROR";

export class ReceiptExtractionError extends Error {
  constructor(
    readonly reason: ExtractorFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "ReceiptExtractionError";
  }
}

export type ReceiptDocument = {
  /** Raw file bytes. */
  bytes: Uint8Array;
  mediaType: string;
  filename: string;
};

export type ReceiptExtractor = {
  name: string;
  /** False when the provider has no credentials configured — the app then
   *  reports honestly instead of pretending extraction is unavailable-but-fine. */
  isConfigured(): boolean;
  extract(document: ReceiptDocument): Promise<ReceiptExtractionResult>;
};
