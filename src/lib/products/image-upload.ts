/**
 * Product-photo upload contract, shared by the browser and the server.
 *
 * Same shape as the receipt contract, and for the same reason: the bytes never
 * pass through a Server Action. A Vercel Function rejects any body over 4.5 MB
 * with a 413 that no `bodySizeLimit` can raise, and a phone photo clears that
 * routinely. The browser uploads straight to Storage and hands the server a
 * path, which makes the path the trust boundary — so the server issues every
 * path and re-checks it, and both sides assert the size and type limits rather
 * than either assuming them.
 *
 * The limits below are the bucket's own limits, restated. If they drift, the
 * upload fails at the bucket with an opaque error instead of here with a
 * sentence a person can act on.
 */

/** The `product-images` bucket's configured limit. */
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

/** The `product-images` bucket's configured mime allow-list. */
export const ALLOWED_PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ProductImageCheck = { ok: true } | { ok: false; message: string };

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Validates a photo before it is uploaded, and again before it is trusted. */
export function validateProductImage(file: { size: number; mediaType: string }): ProductImageCheck {
  if (file.size === 0) return { ok: false, message: "That file is empty — try taking the photo again." };
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return {
      ok: false,
      message: `That photo is ${formatMb(file.size)} — product photos have to be under 5 MB.`,
    };
  }
  const type = file.mediaType.toLowerCase().split(";")[0].trim();
  if (!(ALLOWED_PRODUCT_IMAGE_TYPES as readonly string[]).includes(type)) {
    return { ok: false, message: "That file type can't be shown — use a JPEG, PNG or WebP photo." };
  }
  return { ok: true };
}

/**
 * Strips anything that could change where a name lands or how it reads back.
 * The filename comes from a camera roll and is never trusted to be path-safe.
 */
export function safeImageFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-80);
  return cleaned.length > 0 ? cleaned : "product.jpg";
}

/**
 * Household-scoped object path. The first segment is what the storage policy
 * checks with is_household_member(), so it is the isolation boundary — which
 * is why only the server builds one.
 *
 * The bucket is public-read, so this path is not a secret and is not treated
 * as one. What it protects is the write side: one household cannot place an
 * object inside another's folder, and so cannot overwrite their photographs.
 */
export function buildProductImagePath(householdId: string, filename: string, unique: string): string {
  return `${householdId}/${unique}-${safeImageFilename(filename)}`;
}

/**
 * Re-checks a path the browser hands back before the server records it.
 *
 * Storage RLS already refused a write outside the household's folder, but this
 * fails a bad path in the app's own terms rather than leaving the database as
 * the only thing standing between two households — and, more to the point
 * here, stops an arbitrary string being written into a product's image_url and
 * rendered to everyone who opens the Pantry.
 */
export function productImagePathBelongsToHousehold(path: string, householdId: string): boolean {
  if (!path || path.includes("..") || path.startsWith("/")) return false;
  const segments = path.split("/");
  if (segments.length !== 2) return false;
  const [prefix, object] = segments;
  return prefix === householdId && object.length > 0;
}

/**
 * The public URL Storage serves this object at.
 *
 * Built from the project URL rather than read back from the upload response so
 * the server never has to trust a client-supplied URL — it only ever trusts a
 * path it issued and just re-verified.
 */
export function productImagePublicUrl(supabaseUrl: string, path: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/product-images/${encoded}`;
}
