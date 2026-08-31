import { describe, expect, it } from "vitest";
import {
  ALLOWED_PRODUCT_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
  buildProductImagePath,
  productImagePathBelongsToHousehold,
  productImagePublicUrl,
  safeImageFilename,
  validateProductImage,
} from "./image-upload";

const HOUSEHOLD = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("validateProductImage", () => {
  it("accepts every type the bucket accepts", () => {
    for (const mediaType of ALLOWED_PRODUCT_IMAGE_TYPES) {
      expect(validateProductImage({ size: 1024, mediaType })).toEqual({ ok: true });
    }
  });

  it("rejects a type the bucket would reject, rather than letting it fail opaquely there", () => {
    const result = validateProductImage({ size: 1024, mediaType: "image/heic" });
    expect(result.ok).toBe(false);
  });

  it("reads the mime type without its parameters", () => {
    expect(validateProductImage({ size: 1024, mediaType: "IMAGE/JPEG; charset=binary" })).toEqual({
      ok: true,
    });
  });

  it("rejects an empty file", () => {
    const result = validateProductImage({ size: 0, mediaType: "image/jpeg" });
    expect(result.ok).toBe(false);
  });

  it("allows a photo exactly at the bucket limit and refuses one past it", () => {
    expect(validateProductImage({ size: MAX_PRODUCT_IMAGE_BYTES, mediaType: "image/jpeg" })).toEqual({
      ok: true,
    });
    const over = validateProductImage({ size: MAX_PRODUCT_IMAGE_BYTES + 1, mediaType: "image/jpeg" });
    expect(over.ok).toBe(false);
    // The size is worth saying out loud — "too big" alone doesn't tell anyone
    // whether their 5.1 MB photo needs a crop or a different camera setting.
    if (!over.ok) expect(over.message).toContain("5.0 MB");
  });
});

describe("safeImageFilename", () => {
  it("keeps a plain name", () => {
    expect(safeImageFilename("ketchup.jpg")).toBe("ketchup.jpg");
  });

  it("drops directory components", () => {
    expect(safeImageFilename("../../etc/passwd")).toBe("passwd");
    expect(safeImageFilename("C:\\photos\\jam.png")).toBe("jam.png");
  });

  it("never returns a name that starts a traversal or a dotfile", () => {
    expect(safeImageFilename("...")).toBe("product.jpg");
    expect(safeImageFilename("")).toBe("product.jpg");
    expect(safeImageFilename(".hidden")).toBe("hidden");
  });

  it("replaces characters that would change how a path is read", () => {
    expect(safeImageFilename("my photo (1)+.jpg")).toBe("my-photo--1--.jpg");
  });
});

describe("buildProductImagePath", () => {
  it("puts the household first, because that segment is the policy check", () => {
    const path = buildProductImagePath(HOUSEHOLD, "ketchup.jpg", "abc123");
    expect(path).toBe(`${HOUSEHOLD}/abc123-ketchup.jpg`);
    expect(productImagePathBelongsToHousehold(path, HOUSEHOLD)).toBe(true);
  });

  it("produces a safe path even from a hostile filename", () => {
    const path = buildProductImagePath(HOUSEHOLD, "../../../secrets.png", "abc123");
    expect(path).toBe(`${HOUSEHOLD}/abc123-secrets.png`);
    expect(productImagePathBelongsToHousehold(path, HOUSEHOLD)).toBe(true);
  });
});

describe("productImagePathBelongsToHousehold", () => {
  it("refuses another household's folder", () => {
    expect(productImagePathBelongsToHousehold(`${OTHER}/abc-ketchup.jpg`, HOUSEHOLD)).toBe(false);
  });

  it("refuses traversal, absolute paths and the wrong depth", () => {
    expect(productImagePathBelongsToHousehold(`${HOUSEHOLD}/../${OTHER}/x.jpg`, HOUSEHOLD)).toBe(false);
    expect(productImagePathBelongsToHousehold(`/${HOUSEHOLD}/x.jpg`, HOUSEHOLD)).toBe(false);
    expect(productImagePathBelongsToHousehold(`${HOUSEHOLD}/nested/x.jpg`, HOUSEHOLD)).toBe(false);
    expect(productImagePathBelongsToHousehold(HOUSEHOLD, HOUSEHOLD)).toBe(false);
  });

  it("refuses an empty object name", () => {
    expect(productImagePathBelongsToHousehold(`${HOUSEHOLD}/`, HOUSEHOLD)).toBe(false);
  });

  it("refuses an empty path", () => {
    expect(productImagePathBelongsToHousehold("", HOUSEHOLD)).toBe(false);
  });
});

describe("productImagePublicUrl", () => {
  it("builds the bucket's public URL", () => {
    expect(productImagePublicUrl("https://abc.supabase.co", `${HOUSEHOLD}/abc-ketchup.jpg`)).toBe(
      `https://abc.supabase.co/storage/v1/object/public/product-images/${HOUSEHOLD}/abc-ketchup.jpg`,
    );
  });

  it("tolerates a trailing slash on the project URL", () => {
    expect(productImagePublicUrl("https://abc.supabase.co/", `${HOUSEHOLD}/x.jpg`)).toBe(
      `https://abc.supabase.co/storage/v1/object/public/product-images/${HOUSEHOLD}/x.jpg`,
    );
  });

  it("encodes each segment without encoding the separators", () => {
    const url = productImagePublicUrl("https://abc.supabase.co", `${HOUSEHOLD}/a b+c.jpg`);
    expect(url).toContain(`/product-images/${HOUSEHOLD}/a%20b%2Bc.jpg`);
  });
});
