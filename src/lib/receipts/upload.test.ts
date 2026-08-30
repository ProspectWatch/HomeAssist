import { describe, expect, it } from "vitest";
import {
  ALLOWED_RECEIPT_TYPES,
  MAX_RECEIPT_BYTES,
  buildReceiptStoragePath,
  safeFilename,
  storagePathBelongsToHousehold,
  validateReceiptUpload,
} from "./upload";
import { SHRINK_ABOVE_BYTES, shouldAttemptShrink, targetDimensions } from "./downscale";

const HOUSEHOLD = "8f1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d";
const OTHER_HOUSEHOLD = "11111111-2222-3333-4444-555555555555";
const MB = 1024 * 1024;

describe("receipt size contract", () => {
  it("keeps the app limit at 15 MB", () => {
    expect(MAX_RECEIPT_BYTES).toBe(15 * MB);
  });

  // The sizes the 1 MB Server Action limit used to reject outright.
  it.each([
    ["500 KB", 500 * 1024],
    ["2 MB", 2 * MB],
    ["5 MB", 5 * MB],
    ["10 MB", 10 * MB],
    ["15 MB exactly", 15 * MB],
  ])("accepts a %s receipt", (_label, size) => {
    expect(validateReceiptUpload({ size, mediaType: "image/jpeg" })).toEqual({ ok: true });
  });

  it("rejects anything over 15 MB with a friendly message naming the size", () => {
    const result = validateReceiptUpload({ size: 16 * MB, mediaType: "image/jpeg" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("16.0 MB");
    expect(result.message).toContain("15 MB");
  });

  it("rejects one byte over the limit, and accepts one byte under", () => {
    expect(validateReceiptUpload({ size: MAX_RECEIPT_BYTES + 1, mediaType: "image/jpeg" }).ok).toBe(false);
    expect(validateReceiptUpload({ size: MAX_RECEIPT_BYTES - 1, mediaType: "image/jpeg" }).ok).toBe(true);
  });

  it("rejects an empty file rather than uploading nothing", () => {
    expect(validateReceiptUpload({ size: 0, mediaType: "image/jpeg" }).ok).toBe(false);
  });
});

describe("accepted file types", () => {
  it.each(ALLOWED_RECEIPT_TYPES)("accepts %s", (mediaType) => {
    expect(validateReceiptUpload({ size: MB, mediaType }).ok).toBe(true);
  });

  it("tolerates a charset suffix and odd casing from the browser", () => {
    expect(validateReceiptUpload({ size: MB, mediaType: "IMAGE/JPEG" }).ok).toBe(true);
    expect(validateReceiptUpload({ size: MB, mediaType: "image/jpeg; charset=binary" }).ok).toBe(true);
  });

  it.each(["application/pdf", "image/heic", "text/plain", ""])(
    "refuses %s, which the extractor cannot read",
    (mediaType) => {
      const result = validateReceiptUpload({ size: MB, mediaType });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/JPEG, PNG or WebP/);
    },
  );
});

describe("household-scoped storage paths", () => {
  it("puts the household id first, where the RLS policy reads it", () => {
    const path = buildReceiptStoragePath(HOUSEHOLD, "IMG_0042.jpg", "abc-123");
    expect(path).toBe(`${HOUSEHOLD}/abc-123-IMG_0042.jpg`);
    expect(path.split("/")[0]).toBe(HOUSEHOLD);
  });

  it("strips directory traversal and separators out of a camera-roll filename", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("a/b/../c.jpg")).toBe("c.jpg");
    expect(safeFilename("....//evil.jpg")).toBe("evil.jpg");
    expect(safeFilename("")).toBe("receipt.jpg");
    expect(buildReceiptStoragePath(HOUSEHOLD, "../escape.jpg", "u")).toBe(`${HOUSEHOLD}/u-escape.jpg`);
  });

  it("accepts a path the server issued for this household", () => {
    const path = buildReceiptStoragePath(HOUSEHOLD, "receipt.jpg", "u-1");
    expect(storagePathBelongsToHousehold(path, HOUSEHOLD)).toBe(true);
  });

  it("refuses another household's path", () => {
    const path = buildReceiptStoragePath(OTHER_HOUSEHOLD, "receipt.jpg", "u-1");
    expect(storagePathBelongsToHousehold(path, HOUSEHOLD)).toBe(false);
  });

  it.each([
    ["traversal", `${HOUSEHOLD}/../${OTHER_HOUSEHOLD}/receipt.jpg`],
    ["nested escape", `${HOUSEHOLD}/sub/receipt.jpg`],
    ["absolute", `/${HOUSEHOLD}/receipt.jpg`],
    ["prefix only", `${HOUSEHOLD}/`],
    ["bare filename", "receipt.jpg"],
    ["empty", ""],
    ["household-id prefix collision", `${HOUSEHOLD}-extra/receipt.jpg`],
  ])("refuses a %s path", (_label, path) => {
    expect(storagePathBelongsToHousehold(path, HOUSEHOLD)).toBe(false);
  });
});

describe("pre-upload shrinking", () => {
  it("leaves a small photo alone", () => {
    expect(shouldAttemptShrink({ size: 800 * 1024, type: "image/jpeg" })).toBe(false);
    expect(shouldAttemptShrink({ size: SHRINK_ABOVE_BYTES, type: "image/jpeg" })).toBe(false);
  });

  it("attempts a large phone photo", () => {
    expect(shouldAttemptShrink({ size: 9 * MB, type: "image/jpeg" })).toBe(true);
  });

  it("never touches a non-image", () => {
    expect(shouldAttemptShrink({ size: 9 * MB, type: "application/pdf" })).toBe(false);
  });

  it("keeps a resolution that can still resolve receipt print", () => {
    const scaled = targetDimensions(4032, 3024);
    expect(scaled).not.toBeNull();
    expect(Math.max(scaled!.width, scaled!.height)).toBe(2600);
    // Aspect ratio preserved — a squashed receipt reads worse, not better.
    expect(scaled!.width / scaled!.height).toBeCloseTo(4032 / 3024, 2);
  });

  it("does not upscale an image that is already small", () => {
    expect(targetDimensions(1200, 1600)).toBeNull();
    expect(targetDimensions(0, 0)).toBeNull();
  });

  it("scales a tall receipt photo by its long edge", () => {
    const scaled = targetDimensions(1500, 5200);
    expect(scaled).toEqual({ width: 750, height: 2600 });
  });
});
