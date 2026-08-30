import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ *
 * TEST FIXTURES ONLY — every OpenAI response here is mocked. No network
 * call is made and no real API key is used anywhere in this suite.
 * ------------------------------------------------------------------ */

// Mock the SDK before importing the module under test. The error classes are
// real constructors so `instanceof` branching in the extractor is exercised.
const createMock = vi.fn();

class MockAPIError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
class MockAPIConnectionError extends Error {}
class MockAPIConnectionTimeoutError extends MockAPIConnectionError {}

vi.mock("openai", () => {
  class MockOpenAI {
    responses = { create: createMock };
    static APIError = MockAPIError;
    static APIConnectionError = MockAPIConnectionError;
    static APIConnectionTimeoutError = MockAPIConnectionTimeoutError;
  }
  return { default: MockOpenAI };
});

// `server-only` throws outside a server component; stub it for the suite.
vi.mock("server-only", () => ({}));

const { createOpenAIReceiptExtractor, receiptModel } = await import("./openai");
const { ReceiptExtractionError } = await import("../types");

const DOC = {
  bytes: new Uint8Array([1, 2, 3, 4]),
  mediaType: "image/jpeg",
  filename: "receipt.jpg",
};

// TEST FIXTURE — a well-read receipt with a product, a discount and tax.
const GOOD_PAYLOAD = {
  retailerName: "Food Basics",
  storeAddress: "123 Test St",
  purchaseDate: "2026-08-30",
  purchaseTime: "16:12",
  subtotalCents: 747,
  taxCents: 0,
  totalCents: 747,
  transactionRef: "T-0001",
  confidence: 0.93,
  rawText: "FOOD BASICS\nCNSTGA BRN FR RNG EGGS 5.49\nBANANAS 1.98",
  items: [
    {
      rawDescription: "CNSTGA BRN FR RNG EGGS",
      quantity: 1,
      unitPriceCents: 549,
      lineTotalCents: 549,
      discountCents: null,
      lineType: "ITEM",
      confidence: 0.94,
    },
    {
      rawDescription: "BANANAS",
      quantity: null,
      unitPriceCents: null,
      lineTotalCents: 198,
      discountCents: null,
      lineType: "ITEM",
      confidence: 0.96,
    },
    {
      rawDescription: "COUPON SAVINGS",
      quantity: null,
      unitPriceCents: null,
      lineTotalCents: -100,
      discountCents: 100,
      lineType: "DISCOUNT",
      confidence: 0.9,
    },
    {
      rawDescription: "HST",
      quantity: null,
      unitPriceCents: null,
      lineTotalCents: 0,
      discountCents: null,
      lineType: "TAX",
      confidence: 0.99,
    },
    {
      rawDescription: "VISA ****1234",
      quantity: null,
      unitPriceCents: null,
      lineTotalCents: null,
      discountCents: null,
      lineType: "UNKNOWN",
      confidence: 0.8,
    },
  ],
};

function mockResponse(payload: unknown) {
  createMock.mockResolvedValueOnce({ output_text: JSON.stringify(payload) });
}

beforeEach(() => {
  createMock.mockReset();
  process.env.CHATGPT_API_KEY = "test-key-not-real";
  delete process.env.OPENAI_RECEIPT_MODEL;
});

afterEach(() => {
  delete process.env.CHATGPT_API_KEY;
  delete process.env.OPENAI_RECEIPT_MODEL;
});

describe("configuration", () => {
  it("reports configured only when CHATGPT_API_KEY is set", () => {
    expect(createOpenAIReceiptExtractor().isConfigured()).toBe(true);
    delete process.env.CHATGPT_API_KEY;
    expect(createOpenAIReceiptExtractor().isConfigured()).toBe(false);
  });

  it("does not fall back to OPENAI_API_KEY", () => {
    delete process.env.CHATGPT_API_KEY;
    process.env.OPENAI_API_KEY = "should-be-ignored";
    expect(createOpenAIReceiptExtractor().isConfigured()).toBe(false);
    delete process.env.OPENAI_API_KEY;
  });

  it("fails honestly when the key is missing, without calling the provider", async () => {
    delete process.env.CHATGPT_API_KEY;
    await expect(createOpenAIReceiptExtractor().extract(DOC)).rejects.toMatchObject({
      reason: "NOT_CONFIGURED",
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("uses a current default model, overridable server-side", () => {
    expect(receiptModel()).toBe("gpt-5.6");
    process.env.OPENAI_RECEIPT_MODEL = "gpt-5.6-mini";
    expect(receiptModel()).toBe("gpt-5.6-mini");
  });
});

describe("valid receipt extraction", () => {
  it("maps a clear receipt onto the shared result shape", async () => {
    mockResponse(GOOD_PAYLOAD);
    const result = await createOpenAIReceiptExtractor().extract(DOC);

    expect(result.retailerName).toBe("Food Basics");
    expect(result.purchaseDate).toBe("2026-08-30");
    expect(result.totalCents).toBe(747);
    expect(result.transactionRef).toBe("T-0001");
    expect(result.rawText).toContain("CNSTGA");
    expect(result.items).toHaveLength(5);
  });

  it("sends the image as an input_image data URL with a strict JSON schema", async () => {
    mockResponse(GOOD_PAYLOAD);
    await createOpenAIReceiptExtractor().extract(DOC);

    const args = createMock.mock.calls[0][0];
    expect(args.model).toBe("gpt-5.6");
    expect(args.text.format.type).toBe("json_schema");
    expect(args.text.format.strict).toBe(true);
    const imageBlock = args.input[0].content.find((c: { type: string }) => c.type === "input_image");
    expect(imageBlock.image_url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("keeps an unstated quantity null rather than assuming 1", async () => {
    mockResponse(GOOD_PAYLOAD);
    const result = await createOpenAIReceiptExtractor().extract(DOC);
    expect(result.items.find((i) => i.rawDescription === "BANANAS")!.quantity).toBeNull();
  });

  it("preserves discount, tax and non-product lines distinctly", async () => {
    mockResponse(GOOD_PAYLOAD);
    const result = await createOpenAIReceiptExtractor().extract(DOC);
    expect(result.items.find((i) => i.lineType === "DISCOUNT")!.discountCents).toBe(100);
    expect(result.items.some((i) => i.lineType === "TAX")).toBe(true);
    // A payment line must not be classified as a product.
    expect(result.items.find((i) => i.rawDescription.startsWith("VISA"))!.lineType).toBe("UNKNOWN");
  });

  it("copies raw descriptions verbatim for later matching", async () => {
    mockResponse(GOOD_PAYLOAD);
    const result = await createOpenAIReceiptExtractor().extract(DOC);
    expect(result.items[0].rawDescription).toBe("CNSTGA BRN FR RNG EGGS");
  });
});

describe("poor images and missing fields", () => {
  it("keeps unreadable header fields null with low confidence", async () => {
    mockResponse({
      retailerName: null,
      purchaseDate: null,
      totalCents: null,
      confidence: 0.18,
      rawText: "?????",
      items: [
        {
          rawDescription: "M?LK 2%",
          quantity: null,
          unitPriceCents: null,
          lineTotalCents: null,
          discountCents: null,
          lineType: "UNKNOWN",
          confidence: 0.25,
        },
      ],
    });
    const result = await createOpenAIReceiptExtractor().extract(DOC);
    expect(result.retailerName).toBeNull();
    expect(result.purchaseDate).toBeNull();
    expect(result.totalCents).toBeNull();
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("handles an unknown retailer without inventing one", async () => {
    mockResponse({ ...GOOD_PAYLOAD, retailerName: null });
    const result = await createOpenAIReceiptExtractor().extract(DOC);
    expect(result.retailerName).toBeNull();
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("tolerates a payload with no items at all", async () => {
    mockResponse({ retailerName: "Corner Store", confidence: 0.4, rawText: "", items: [] });
    const result = await createOpenAIReceiptExtractor().extract(DOC);
    expect(result.items).toHaveLength(0);
  });
});

describe("provider failures", () => {
  it("rejects an unsupported file type before calling the provider", async () => {
    await expect(
      createOpenAIReceiptExtractor().extract({ ...DOC, mediaType: "application/pdf" }),
    ).rejects.toMatchObject({ reason: "UNSUPPORTED_FORMAT" });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("reports malformed (non-JSON) provider output as a provider error", async () => {
    createMock.mockResolvedValueOnce({ output_text: "not json at all" });
    await expect(createOpenAIReceiptExtractor().extract(DOC)).rejects.toMatchObject({
      reason: "PROVIDER_ERROR",
    });
  });

  it("rejects a JSON payload that isn't an object", async () => {
    createMock.mockResolvedValueOnce({ output_text: "[1,2,3]" });
    await expect(createOpenAIReceiptExtractor().extract(DOC)).rejects.toMatchObject({
      reason: "PROVIDER_ERROR",
    });
  });

  it("reports an empty response as unreadable", async () => {
    createMock.mockResolvedValueOnce({ output_text: "" });
    await expect(createOpenAIReceiptExtractor().extract(DOC)).rejects.toMatchObject({
      reason: "UNREADABLE",
    });
  });

  it("maps a rejected key to NOT_CONFIGURED", async () => {
    createMock.mockRejectedValueOnce(new MockAPIError(401, "Unauthorized"));
    await expect(createOpenAIReceiptExtractor().extract(DOC)).rejects.toMatchObject({
      reason: "NOT_CONFIGURED",
    });
  });

  it("maps rate limiting to a retryable provider error", async () => {
    createMock.mockRejectedValueOnce(new MockAPIError(429, "Too Many Requests"));
    await expect(createOpenAIReceiptExtractor().extract(DOC)).rejects.toMatchObject({
      reason: "PROVIDER_ERROR",
    });
  });

  it("maps a timeout to a retryable provider error", async () => {
    createMock.mockRejectedValueOnce(new MockAPIConnectionTimeoutError("timed out"));
    const err = await createOpenAIReceiptExtractor()
      .extract(DOC)
      .catch((e) => e);
    expect(err).toBeInstanceOf(ReceiptExtractionError);
    expect(err.reason).toBe("PROVIDER_ERROR");
    expect(err.message).toMatch(/saved/i);
  });

  it("never leaks the API key or provider internals in an error message", async () => {
    createMock.mockRejectedValueOnce(
      new MockAPIError(500, "Internal error with Authorization: Bearer test-key-not-real"),
    );
    const err = await createOpenAIReceiptExtractor()
      .extract(DOC)
      .catch((e) => e);
    expect(err.message).not.toContain("test-key-not-real");
    expect(err.message).not.toMatch(/authorization|bearer/i);
  });
});
