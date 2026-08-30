/**
 * Receipt upload contract, shared by the browser and the server.
 *
 * The bytes no longer travel through a Server Action: a phone photo is 3-12 MB
 * and a Vercel Function rejects any request body over 4.5 MB with a 413, which
 * no Next.js `bodySizeLimit` can raise. The browser uploads straight to the
 * private Supabase Storage bucket instead, and the server is handed a path.
 *
 * That makes the path the trust boundary, so the rules live here, in one place
 * both sides import: the server ISSUES every path (the browser never invents
 * one) and re-checks it before reading, and the size and type limits are
 * asserted on both sides rather than assumed on either.
 */

/** The app's receipt size contract. Also enforced on the storage bucket. */
export const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

/** Exactly what the extractor can read — see extractors/openai.ts. */
export const ALLOWED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export type ReceiptUploadCheck = { ok: true } | { ok: false; message: string };

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Validates a file before it is uploaded, and again after it is read back. */
export function validateReceiptUpload(file: { size: number; mediaType: string }): ReceiptUploadCheck {
  if (file.size === 0) return { ok: false, message: "That file is empty — try taking the photo again." };
  if (file.size > MAX_RECEIPT_BYTES) {
    return {
      ok: false,
      message: `That image is ${formatMb(file.size)} — receipts have to be under 15 MB.`,
    };
  }
  const type = file.mediaType.toLowerCase().split(";")[0].trim();
  if (!(ALLOWED_RECEIPT_TYPES as readonly string[]).includes(type)) {
    return {
      ok: false,
      message: "That file type can't be read — use a JPEG, PNG or WebP photo.",
    };
  }
  return { ok: true };
}

/**
 * Strips anything that could change where a name lands or how it is read back.
 * A receipt filename comes from the user's camera roll and is never trusted to
 * be path-safe.
 */
export function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^[.-]+/, "").slice(-80);
  return cleaned.length > 0 ? cleaned : "receipt.jpg";
}

/**
 * Household-scoped object path. The first segment is what the storage RLS
 * policy checks with is_household_member(), so it is the isolation boundary —
 * which is why only the server builds one.
 */
export function buildReceiptStoragePath(householdId: string, filename: string, unique: string): string {
  return `${householdId}/${unique}-${safeFilename(filename)}`;
}

/**
 * Re-checks a path the browser hands back before the server reads it.
 *
 * Storage RLS would already refuse another household's object, but a request
 * that should never have been made is not a request worth making: this fails
 * it here, in the app's own terms, rather than relying on the database as the
 * only thing standing between two households.
 */
export function storagePathBelongsToHousehold(path: string, householdId: string): boolean {
  if (!path || path.includes("..") || path.startsWith("/")) return false;
  const segments = path.split("/");
  if (segments.length !== 2) return false;
  const [prefix, object] = segments;
  return prefix === householdId && object.length > 0;
}
