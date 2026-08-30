import "server-only";

import OpenAI from "openai";
import { normalizeExtraction } from "../extraction-normalize";
import {
  ReceiptExtractionError,
  type ReceiptDocument,
  type ReceiptExtractionResult,
  type ReceiptExtractor,
} from "../types";

/**
 * Receipt extraction using OpenAI's Responses API with image input.
 *
 * Runs server-side only (`server-only`); the API key is read from the
 * environment and never reaches the browser, is never logged, and is never
 * returned in any result.
 *
 * The prompt's first rule is to return null rather than guess: a
 * plausible-looking invented total is far worse than a missing one, because
 * the review screen can surface a gap but cannot detect a confident
 * fabrication.
 */

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Overridable server-side so the model can move without a deploy of new code. */
const DEFAULT_MODEL = "gpt-5.6";

export function receiptModel(): string {
  return process.env.OPENAI_RECEIPT_MODEL || DEFAULT_MODEL;
}

/**
 * Strict JSON schema for the extraction. Mirrors ReceiptExtractionResult so
 * the rest of HomeAssist never sees an OpenAI-shaped payload.
 */
const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    retailerName: { type: ["string", "null"], description: "Store name exactly as printed." },
    storeAddress: { type: ["string", "null"] },
    purchaseDate: { type: ["string", "null"], description: "ISO YYYY-MM-DD, or null if not legible." },
    purchaseTime: { type: ["string", "null"], description: "HH:MM 24-hour, or null." },
    subtotalCents: { type: ["integer", "null"] },
    taxCents: { type: ["integer", "null"] },
    totalCents: { type: ["integer", "null"] },
    transactionRef: { type: ["string", "null"], description: "Transaction/reference number if printed." },
    confidence: { type: "number", description: "0..1 overall confidence in this reading." },
    rawText: { type: "string", description: "All text read from the receipt, line by line." },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          rawDescription: {
            type: "string",
            description: "Line text exactly as printed, including abbreviations.",
          },
          quantity: {
            type: ["number", "null"],
            description: "Only if printed. Null otherwise — never assume 1.",
          },
          unitPriceCents: { type: ["integer", "null"] },
          lineTotalCents: { type: ["integer", "null"] },
          discountCents: { type: ["integer", "null"] },
          lineType: {
            type: "string",
            enum: ["ITEM", "DISCOUNT", "TAX", "SUBTOTAL", "TOTAL", "UNKNOWN"],
          },
          confidence: { type: "number" },
        },
        required: [
          "rawDescription",
          "quantity",
          "unitPriceCents",
          "lineTotalCents",
          "discountCents",
          "lineType",
          "confidence",
        ],
      },
    },
  },
  required: [
    "retailerName",
    "storeAddress",
    "purchaseDate",
    "purchaseTime",
    "subtotalCents",
    "taxCents",
    "totalCents",
    "transactionRef",
    "confidence",
    "rawText",
    "items",
  ],
} as const;

const INSTRUCTIONS = `You transcribe grocery receipts. You are a reader, not an interpreter.

Rules, in priority order:
1. NEVER invent a value. If a field is not printed on the receipt, or you cannot read it confidently, return null. A missing value is correct; a guessed value is a serious error because it becomes household financial history.
2. Copy line descriptions EXACTLY as printed, including abbreviations and truncation (e.g. "CNSTGA BRN FR RNG EGGS"). Do not expand, correct, or normalize them — later catalogue matching depends on the raw text.
3. Do not assume a quantity of 1 when no quantity is printed. Return null.
4. All money values are integer cents (e.g. $5.49 -> 549).
5. Classify every line precisely:
   - ITEM for a purchasable product
   - DISCOUNT for coupons, savings, price reductions and loyalty discounts
   - TAX for HST/GST/PST lines
   - SUBTOTAL and TOTAL for those summary lines
   - UNKNOWN for payment, loyalty balance, reference, cashier or store-info lines
   Payment method, loyalty point balances and reference numbers are NOT products.
6. Do not infer a brand that is not present in the printed text.
7. Set per-line and overall confidence honestly. Low confidence on a blurry or partially obscured receipt is useful information, not a failure.`;

export function createOpenAIReceiptExtractor(): ReceiptExtractor {
  return {
    name: `openai-${receiptModel()}`,

    isConfigured() {
      // Deliberately CHATGPT_API_KEY — the app does not assume OPENAI_API_KEY.
      return !!process.env.CHATGPT_API_KEY;
    },

    async extract(document: ReceiptDocument): Promise<ReceiptExtractionResult> {
      const apiKey = process.env.CHATGPT_API_KEY;
      if (!apiKey) {
        throw new ReceiptExtractionError(
          "NOT_CONFIGURED",
          "No receipt extraction provider is configured. Set CHATGPT_API_KEY to enable automatic reading.",
        );
      }
      if (!SUPPORTED_IMAGE_TYPES.has(document.mediaType)) {
        throw new ReceiptExtractionError(
          "UNSUPPORTED_FORMAT",
          `${document.mediaType} can't be read yet — upload a JPEG, PNG or WebP photo.`,
        );
      }

      const client = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 1 });
      const dataUrl = `data:${document.mediaType};base64,${Buffer.from(document.bytes).toString("base64")}`;

      let response: Awaited<ReturnType<typeof client.responses.create>>;
      try {
        response = await client.responses.create({
          model: receiptModel(),
          instructions: INSTRUCTIONS,
          input: [
            {
              role: "user",
              content: [
                { type: "input_image", image_url: dataUrl, detail: "high" },
                {
                  type: "input_text",
                  text: "Transcribe this receipt. Return null for anything not clearly printed.",
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "receipt_extraction",
              schema: RECEIPT_SCHEMA as unknown as Record<string, unknown>,
              strict: true,
            },
          },
        });
      } catch (err) {
        throw toExtractionError(err);
      }

      const text = response.output_text;
      if (!text) {
        throw new ReceiptExtractionError("UNREADABLE", "Couldn't read anything from that image.");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new ReceiptExtractionError(
          "PROVIDER_ERROR",
          "The extraction service returned a malformed response. Try again.",
        );
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new ReceiptExtractionError(
          "PROVIDER_ERROR",
          "The extraction service returned an unexpected response. Try again.",
        );
      }

      return normalizeExtraction(parsed as Record<string, unknown>);
    },
  };
}

/**
 * Maps provider errors onto our own failure vocabulary. No provider message
 * that could carry credentials or headers is ever passed through verbatim.
 */
function toExtractionError(err: unknown): ReceiptExtractionError {
  if (err instanceof ReceiptExtractionError) return err;

  if (err instanceof OpenAI.APIError) {
    if (err.status === 401 || err.status === 403) {
      return new ReceiptExtractionError(
        "NOT_CONFIGURED",
        "The configured extraction API key was rejected.",
      );
    }
    if (err.status === 429) {
      return new ReceiptExtractionError(
        "PROVIDER_ERROR",
        "Extraction is rate limited right now — try again shortly.",
      );
    }
    return new ReceiptExtractionError("PROVIDER_ERROR", `Extraction failed (${err.status ?? "error"}).`);
  }
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return new ReceiptExtractionError(
      "PROVIDER_ERROR",
      "Reading the receipt timed out — the upload is saved, try again.",
    );
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new ReceiptExtractionError(
      "PROVIDER_ERROR",
      "Couldn't reach the extraction service — the upload is saved, try again.",
    );
  }
  return new ReceiptExtractionError("PROVIDER_ERROR", "Extraction failed. The upload is saved — try again.");
}
