import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { normalizeExtraction } from "../extraction-normalize";
import {
  ReceiptExtractionError,
  type ReceiptDocument,
  type ReceiptExtractionResult,
  type ReceiptExtractor,
} from "../types";

/**
 * Receipt extraction using Claude's vision capability.
 *
 * NOT WIRED INTO PRODUCTION. The active provider is
 * `extractors/openai.ts` (see getExtractor() in lib/data/receipt-pipeline.ts).
 * This implementation is retained as a working second provider so the
 * ReceiptExtractor abstraction stays honest — an interface with only one
 * implementation is an assumption, not a seam.
 *
 * Runs server-side only. The API key is read from the environment and never
 * reaches the browser (§20, §23).
 *
 * The prompt's single most important instruction is to leave a field null
 * rather than guess it: a plausible-looking invented total is far worse than a
 * missing one, because the review screen can surface a gap but cannot detect a
 * confident fabrication.
 */

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_receipt",
  description: "Record the fields read from a grocery receipt image.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      retailerName: { type: ["string", "null"], description: "Store name exactly as printed." },
      storeAddress: { type: ["string", "null"] },
      purchaseDate: { type: ["string", "null"], description: "ISO YYYY-MM-DD, or null if not legible." },
      purchaseTime: { type: ["string", "null"], description: "HH:MM 24h, or null." },
      subtotalCents: { type: ["integer", "null"], description: "Subtotal in cents." },
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
            rawDescription: { type: "string", description: "Line text exactly as printed, including abbreviations." },
            quantity: { type: ["number", "null"], description: "Only if printed. Null otherwise — do not assume 1." },
            unitPriceCents: { type: ["integer", "null"] },
            lineTotalCents: { type: ["integer", "null"] },
            discountCents: { type: ["integer", "null"] },
            lineType: { type: "string", enum: ["ITEM", "DISCOUNT", "TAX", "SUBTOTAL", "TOTAL", "UNKNOWN"] },
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
  },
  strict: true,
};

const SYSTEM_PROMPT = `You transcribe grocery receipts. You are a reader, not an interpreter.

Rules, in priority order:
1. NEVER invent a value. If a field is not printed on the receipt, or you cannot read it confidently, return null. A missing value is correct; a guessed value is a serious error because it becomes household financial history.
2. Copy line descriptions EXACTLY as printed, including abbreviations and truncation (e.g. "CNSTGA BRN FR RNG EGGS"). Do not expand, correct, or normalize them — later matching depends on the raw text.
3. Do not assume a quantity of 1 when no quantity is printed. Return null.
4. All money values are integer cents (e.g. $5.49 -> 549).
5. Classify each line: ITEM for products, DISCOUNT for coupons/savings lines, TAX, SUBTOTAL, TOTAL, or UNKNOWN.
6. Set per-line and overall confidence honestly. Low confidence on a blurry or partially obscured receipt is useful information, not a failure.`;

export function createAnthropicReceiptExtractor(): ReceiptExtractor {
  return {
    name: "anthropic-claude-vision",

    isConfigured() {
      return !!process.env.ANTHROPIC_API_KEY;
    },

    async extract(document: ReceiptDocument): Promise<ReceiptExtractionResult> {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new ReceiptExtractionError(
          "NOT_CONFIGURED",
          "No receipt extraction provider is configured. Set ANTHROPIC_API_KEY to enable automatic reading.",
        );
      }
      if (!SUPPORTED_IMAGE_TYPES.has(document.mediaType)) {
        throw new ReceiptExtractionError(
          "UNSUPPORTED_FORMAT",
          `${document.mediaType} can't be read yet — upload a JPEG, PNG or WebP photo.`,
        );
      }

      const client = new Anthropic({ apiKey });
      const base64 = Buffer.from(document.bytes).toString("base64");

      try {
        const response = await client.messages.create({
          model: "claude-opus-5",
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          system: SYSTEM_PROMPT,
          tools: [EXTRACTION_TOOL],
          tool_choice: { type: "tool", name: "record_receipt" },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: document.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                    data: base64,
                  },
                },
                { type: "text", text: "Transcribe this receipt. Return null for anything not clearly printed." },
              ],
            },
          ],
        });

        const toolUse = response.content.find(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
        );
        if (!toolUse) {
          throw new ReceiptExtractionError("UNREADABLE", "Couldn't read anything from that image.");
        }

        // Tool inputs are parsed JSON already; never string-match on them.
        const parsed = toolUse.input as Record<string, unknown>;
        return normalizeExtraction(parsed);
      } catch (err) {
        if (err instanceof ReceiptExtractionError) throw err;
        if (err instanceof Anthropic.AuthenticationError) {
          throw new ReceiptExtractionError("NOT_CONFIGURED", "The configured extraction API key was rejected.");
        }
        if (err instanceof Anthropic.RateLimitError) {
          throw new ReceiptExtractionError("PROVIDER_ERROR", "Extraction is rate limited — try again shortly.");
        }
        if (err instanceof Anthropic.APIError) {
          throw new ReceiptExtractionError("PROVIDER_ERROR", `Extraction failed (${err.status}).`);
        }
        throw new ReceiptExtractionError(
          "PROVIDER_ERROR",
          err instanceof Error ? err.message : "Extraction failed.",
        );
      }
    },
  };
}
