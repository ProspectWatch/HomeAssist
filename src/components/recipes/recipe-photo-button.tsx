"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_PRODUCT_IMAGE_TYPES, validateProductImage } from "@/lib/products/image-upload";
import { addRecipeImage, prepareRecipeImageUpload } from "@/app/(shell)/shop/recipes/[id]/actions";

/**
 * Adds a photo to a recipe — the cover, or another one for the gallery.
 *
 * Uploads straight from the browser to Storage and hands the server only the
 * path it issued, the same two-step the pantry's product photos use. Between
 * the two calls the file exists but is attached to nothing, which is the right
 * way round: an orphaned object costs a few kilobytes, a recipe pointing at a
 * failed upload renders a broken tile.
 */
export function RecipePhotoButton({
  recipeId,
  isCover,
  label,
  className,
  onDone,
  onError,
}: {
  recipeId: string;
  isCover: boolean;
  label: string;
  className?: string;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    const check = validateProductImage({ size: file.size, mediaType: file.type });
    if (!check.ok) {
      onError(check.message);
      return;
    }

    setBusy(true);
    try {
      const target = await prepareRecipeImageUpload({
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

      const saved = await addRecipeImage({
        recipeId,
        storagePath: target.storagePath,
        isCover,
      });
      if (!saved.ok) {
        onError(saved.message);
        return;
      }
      startTransition(onDone);
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
        className={
          className ??
          "cursor-pointer rounded-(--radius-sm) border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-50"
        }
      >
        {working ? "Uploading…" : label}
      </button>
    </>
  );
}
