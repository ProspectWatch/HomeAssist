import { describe, expect, it } from "vitest";
import { normalizeExtraction } from "./extraction-normalize";
import { aliasKey, isProductLine, matchReceiptLine } from "./matching";
import { findDuplicateReceipt, type ExistingReceipt } from "./duplicate";
import type { MatchableCatalogProduct } from "@/lib/retailers/matching";

/* ------------------------------------------------------------------ *
 * TEST FIXTURES ONLY — invented receipts and prices. None of this is
 * Brown Family data and none of it is written to production.
 * ------------------------------------------------------------------ */

const CATALOG: MatchableCatalogProduct[] = [
  {
    id: "conestoga-brown-free-range-eggs",
    display_name: "Conestoga Brown Free-Range Eggs",
    brand: "Conestoga",
    category: "Dairy & Eggs",
    subcategory: "Eggs",
    search_aliases: ["eggs"],
    default_unit: "dozen",
  },
  {
    id: "bananas",
    display_name: "Bananas",
    brand: null,
    category: "Produce",
    subcategory: "Fruit",
    search_aliases: ["banana"],
    default_unit: "bunch",
  },
  {
    id: "green-bell-pepper",
    display_name: "Green Bell Pepper",
    brand: null,
    category: "Produce",
    subcategory: "Vegetables",
    search_aliases: [],
    default_unit: "ea",
  },
  {
    id: "red-bell-pepper",
    display_name: "Red Bell Pepper",
    brand: null,
    category: "Produce",
    subcategory: "Vegetables",
    search_aliases: [],
    default_unit: "ea",
  },
  {
    id: "earth-s-own-original-almond-milk",
    display_name: "Earth's Own Original Almond Milk",
    brand: "Earth's Own",
    category: "Dairy & Eggs",
    subcategory: "Milk",
    search_aliases: ["almond milk"],
    default_unit: "1.89 L",
  },
];

// TEST FIXTURE — a clear receipt, shaped like the extractor's tool output.
const CLEAR_RECEIPT = {
  retailerName: "Food Basics",
  storeAddress: "123 Test St",
  purchaseDate: "2026-08-30",
  purchaseTime: "16:12",
  subtotalCents: 1247,
  taxCents: 0,
  totalCents: 1247,
  transactionRef: "T-0001",
  confidence: 0.94,
  rawText: "FOOD BASICS\nCNSTGA BRN FR RNG EGGS 5.49\nBANANAS 1.98\nSUBTOTAL 12.47",
  items: [
    {
      rawDescription: "CNSTGA BRN FR RNG EGGS",
      quantity: 1,
      unitPriceCents: 549,
      lineTotalCents: 549,
      discountCents: null,
      lineType: "ITEM",
      confidence: 0.93,
    },
    {
      rawDescription: "BANANAS",
      quantity: null,
      unitPriceCents: null,
      lineTotalCents: 198,
      discountCents: null,
      lineType: "ITEM",
      confidence: 0.97,
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
  ],
};

// TEST FIXTURE — a poor-quality scan: most fields unreadable.
const POOR_RECEIPT = {
  retailerName: null,
  purchaseDate: null,
  totalCents: null,
  confidence: 0.21,
  rawText: "?????",
  items: [
    {
      rawDescription: "M?LK 2%",
      quantity: null,
      unitPriceCents: null,
      lineTotalCents: null,
      discountCents: null,
      lineType: "UNKNOWN",
      confidence: 0.3,
    },
  ],
};

describe("extraction normalization", () => {
  it("reads a clear receipt into the shared result shape", () => {
    const result = normalizeExtraction(CLEAR_RECEIPT);
    expect(result.retailerName).toBe("Food Basics");
    expect(result.purchaseDate).toBe("2026-08-30");
    expect(result.totalCents).toBe(1247);
    expect(result.items).toHaveLength(4);
    expect(result.items[0].rawDescription).toBe("CNSTGA BRN FR RNG EGGS");
  });

  it("keeps an unknown quantity null instead of assuming 1", () => {
    const result = normalizeExtraction(CLEAR_RECEIPT);
    const bananas = result.items.find((i) => i.rawDescription === "BANANAS")!;
    expect(bananas.quantity).toBeNull();
    expect(bananas.lineTotalCents).toBe(198);
  });

  it("preserves discount and tax lines as their own line types", () => {
    const result = normalizeExtraction(CLEAR_RECEIPT);
    expect(result.items.find((i) => i.lineType === "DISCOUNT")?.discountCents).toBe(100);
    expect(result.items.some((i) => i.lineType === "TAX")).toBe(true);
  });

  it("keeps a poor-quality receipt's unreadable fields null with low confidence", () => {
    const result = normalizeExtraction(POOR_RECEIPT);
    expect(result.retailerName).toBeNull();
    expect(result.purchaseDate).toBeNull();
    expect(result.totalCents).toBeNull();
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("drops lines with no description rather than inventing one", () => {
    const result = normalizeExtraction({ items: [{ rawDescription: "", lineType: "ITEM" }] });
    expect(result.items).toHaveLength(0);
  });

  it("preserves raw text for review", () => {
    expect(normalizeExtraction(CLEAR_RECEIPT).rawText).toContain("CNSTGA");
  });
});

describe("receipt line matching", () => {
  it("maps an abbreviated description to the right catalogue product", () => {
    const match = matchReceiptLine("CNSTGA BRN FR RNG EGGS", CATALOG);
    expect(match.catalogProductId).toBe("conestoga-brown-free-range-eggs");
    expect(["MATCHED", "LIKELY_MATCH"]).toContain(match.status);
  });

  it("matches a clear full-word description with high confidence", () => {
    const match = matchReceiptLine("BANANAS", CATALOG);
    expect(match.catalogProductId).toBe("bananas");
    expect(match.status).toBe("MATCHED");
  });

  it("reuses a confirmed alias outright", () => {
    const match = matchReceiptLine("XYZ HOUSE BRAND EGG", CATALOG, {
      aliases: [{ rawDescription: aliasKey("XYZ HOUSE BRAND EGG"), catalogProductId: "conestoga-brown-free-range-eggs" }],
    });
    expect(match.status).toBe("MATCHED");
    expect(match.matchMethod).toBe("confirmed_alias");
    expect(match.confidence).toBe(1);
  });

  it("sends an ambiguous line to review rather than guessing", () => {
    const match = matchReceiptLine("BELL PEPPER", CATALOG);
    expect(match.catalogProductId).toBeNull();
    expect(match.status).toBe("REVIEW_REQUIRED");
  });

  it("leaves an unrecognizable line unmatched", () => {
    const match = matchReceiptLine("ZZQX 9910", CATALOG);
    expect(match.catalogProductId).toBeNull();
    expect(["UNMATCHED", "REVIEW_REQUIRED"]).toContain(match.status);
  });

  it("prefers a product the household actually buys", () => {
    const withoutBias = matchReceiptLine("ALMOND MILK", CATALOG);
    const withBias = matchReceiptLine("ALMOND MILK", CATALOG, {
      householdProductIds: new Set(["earth-s-own-original-almond-milk"]),
    });
    expect(withBias.confidence).toBeGreaterThanOrEqual(withoutBias.confidence);
  });

  it("never treats tax or subtotal lines as products", () => {
    expect(isProductLine("TAX")).toBe(false);
    expect(isProductLine("SUBTOTAL")).toBe(false);
    expect(isProductLine("DISCOUNT")).toBe(false);
    expect(isProductLine("ITEM")).toBe(true);
  });
});

describe("duplicate receipt protection", () => {
  const existing: ExistingReceipt[] = [
    {
      id: "r1",
      documentHash: "abc123",
      retailerName: "Food Basics",
      purchaseDate: "2026-08-30",
      totalCents: 1247,
      transactionRef: "T-0001",
    },
  ];

  it("catches a byte-identical re-upload", () => {
    const dup = findDuplicateReceipt(
      { documentHash: "abc123", retailerName: null, purchaseDate: null, totalCents: null, transactionRef: null },
      existing,
    );
    expect(dup?.kind).toBe("EXACT");
  });

  it("catches a re-photograph by store, date and total", () => {
    const dup = findDuplicateReceipt(
      {
        documentHash: "different",
        retailerName: "food basics",
        purchaseDate: "2026-08-30",
        totalCents: 1247,
        transactionRef: null,
      },
      existing,
    );
    expect(dup?.kind).toBe("LIKELY");
  });

  it("catches a matching transaction reference", () => {
    const dup = findDuplicateReceipt(
      {
        documentHash: "different",
        retailerName: "Food Basics",
        purchaseDate: "2026-09-02",
        totalCents: 999,
        transactionRef: "T-0001",
      },
      existing,
    );
    expect(dup?.kind).toBe("LIKELY");
  });

  it("allows a genuinely different shop at the same store", () => {
    const dup = findDuplicateReceipt(
      {
        documentHash: "different",
        retailerName: "Food Basics",
        purchaseDate: "2026-08-31",
        totalCents: 4210,
        transactionRef: "T-0002",
      },
      existing,
    );
    expect(dup).toBeNull();
  });
});
