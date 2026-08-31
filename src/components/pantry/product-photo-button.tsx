"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ALLOWED_PRODUCT_IMAGE_TYPES,
  validateProductImage,
} from "@/lib/products/image-upload";

type Props = {
  /** Shown so a new preference row created by the write is labelled. */
  title: string;
  catalogProductId: string | null;
  productId: string | null;
  hasPhoto: boolean;
  onUploaded: () => void;
  onError: (message: string) => void;
  prepare: (file: { filename: string; mediaType: string; size: number }) =>
    Promise<{ ok: true; storagePath: string } | { ok: false; message: string }>;
  attach: (item: {
    catalogProductId?: string | null;
    productId?: string | null;
    title: string;
    storagePath: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
};

/**
 * Camera button on a pantry row.
 *
 * The bytes go straight from the browser to Storage — a Server Action would
 * 413 on a phone photo — so the server's part is to issue the path first and
 * record it after. Between those two calls the file is in Storage but attached
 * to nothing, which is the right way round: an orphaned object costs a few
 * kilobytes, whereas a product pointing at an object that failed to upload
 * would render a broken tile.
 */
export function ProductPhotoButton({
  title,
  catalogProductId,
  productId,
  hasPhoto,
  onUploaded,
  onError,
  prepare,
  attach,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    // Checked here so an oversized photo is refused instantly and in the app's
    // own words, rather than after a slow upload the bucket then rejects.
    const check = validateProductImage({ size: file.size, mediaType: file.type });
    if (!check.ok) {
      onError(check.message);
      return;
    }

    setBusy(true);
    try {
      const target = await prepare({
        filename: file.name,
        mediaType: file.type,
        size: file.size,
      });
      if (!target.ok) {
        onError(target.message);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.storage
        .from("product-images")
        .upload(target.storagePath, file, { contentType: file.type, upsert: false });
      if (error) {
        onError("That photo didn't upload — check your connection and try again.");
        return;
      }

      const saved = await attach({
        catalogProductId,
        productId,
        title,
        storagePath: target.storagePath,
      });
      if (!saved.ok) {
        onError(saved.message);
        return;
      }
      startTransition(onUploaded);
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_PRODUCT_IMAGE_TYPES.join(",")}
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so choosing the same file twice still fires a change.
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={working}
        onClick={() => inputRef.current?.click()}
        aria-label={hasPhoto ? `Replace the photo of ${title}` : `Add a photo of ${title}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-white text-oak disabled:opacity-50"
      >
        {working ? (
          <span className="text-[10px] font-semibold">···</span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-1.7A1 1 0 0 1 8.6 5h6.8a1 1 0 0 1 .8.3L17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
            <circle cx="12" cy="12.8" r="3.2" />
          </svg>
        )}
      </button>
    </>
  );
}
