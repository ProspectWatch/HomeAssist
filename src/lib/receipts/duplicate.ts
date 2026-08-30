/**
 * Duplicate receipt protection (§22).
 *
 * Two tiers, because the same receipt can arrive as a different file:
 *   EXACT     — byte-identical upload (same SHA-256). Certain.
 *   LIKELY    — same retailer, date and total, or a matching transaction ref.
 *               A re-photograph of a receipt already imported.
 * Both warn; neither silently blocks or silently imports. Importing the same
 * shop twice would double household spend history and skew every derived
 * price statistic.
 */

export type ExistingReceipt = {
  id: string;
  documentHash: string | null;
  retailerName: string | null;
  purchaseDate: string | null;
  totalCents: number | null;
  transactionRef: string | null;
};

export type DuplicateCandidate = {
  receiptId: string;
  kind: "EXACT" | "LIKELY";
  reason: string;
};

export type DuplicateCheckInput = {
  documentHash: string | null;
  retailerName: string | null;
  purchaseDate: string | null;
  totalCents: number | null;
  transactionRef: string | null;
};

function sameText(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function findDuplicateReceipt(
  incoming: DuplicateCheckInput,
  existing: ExistingReceipt[],
): DuplicateCandidate | null {
  if (incoming.documentHash) {
    const exact = existing.find((r) => r.documentHash && r.documentHash === incoming.documentHash);
    if (exact) {
      return {
        receiptId: exact.id,
        kind: "EXACT",
        reason: "This exact file has already been uploaded.",
      };
    }
  }

  // A printed transaction reference is near-unique per store.
  if (incoming.transactionRef) {
    const byRef = existing.find(
      (r) => sameText(r.transactionRef, incoming.transactionRef) && sameText(r.retailerName, incoming.retailerName),
    );
    if (byRef) {
      return {
        receiptId: byRef.id,
        kind: "LIKELY",
        reason: "A receipt with this transaction number is already imported.",
      };
    }
  }

  // Same store, same day, same total — almost certainly the same shop.
  if (incoming.retailerName && incoming.purchaseDate && incoming.totalCents !== null) {
    const byShop = existing.find(
      (r) =>
        sameText(r.retailerName, incoming.retailerName) &&
        r.purchaseDate === incoming.purchaseDate &&
        r.totalCents === incoming.totalCents,
    );
    if (byShop) {
      return {
        receiptId: byShop.id,
        kind: "LIKELY",
        reason: "A receipt from the same store, date and total is already imported.",
      };
    }
  }

  return null;
}

/** SHA-256 of the uploaded bytes, using the Web Crypto API. */
export async function hashDocument(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
