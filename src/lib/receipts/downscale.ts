/**
 * Optional client-side shrink before upload.
 *
 * A modern phone camera produces a 12-30 MP image; a receipt needs enough
 * resolution to read 8pt thermal print and no more. Shrinking is about upload
 * time on a phone signal, not about squeezing under a limit — the 15 MB
 * contract is unchanged, and anything that can't be shrunk is uploaded as-is.
 *
 * Legibility wins over size every time: if the result would be bigger, or the
 * browser can't decode the image, the original is used untouched.
 */

/**
 * Long edge, in pixels, kept after shrinking. Generous on purpose — a receipt
 * photographed at 2600px across still resolves faint thermal print, and
 * over-shrinking costs line items the extractor would otherwise have read.
 */
export const MAX_LONG_EDGE = 2600;

/** JPEG quality. High enough that compression artefacts don't blur digits. */
export const JPEG_QUALITY = 0.92;

/** Below this, shrinking isn't worth the risk of losing detail. */
export const SHRINK_ABOVE_BYTES = 2 * 1024 * 1024;

/** Scaled dimensions, or null when the image is already small enough. */
export function targetDimensions(
  width: number,
  height: number,
  maxLongEdge = MAX_LONG_EDGE,
): { width: number; height: number } | null {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge || longEdge === 0) return null;
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Whether a file is even worth attempting to shrink. */
export function shouldAttemptShrink(file: { size: number; type: string }): boolean {
  return file.size > SHRINK_ABOVE_BYTES && file.type.toLowerCase().startsWith("image/");
}

/**
 * Browser-only. Returns the original file whenever shrinking would not clearly
 * help — including any decode or encode failure, which is never fatal here.
 */
export async function shrinkReceiptImage(file: File): Promise<File> {
  if (typeof window === "undefined" || !shouldAttemptShrink(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const target = targetDimensions(bitmap.width, bitmap.height);
    if (!target) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    // Unsupported format (HEIC on a browser that can't decode it), a tainted
    // canvas, memory pressure — none of which should stop an upload.
    return file;
  }
}
