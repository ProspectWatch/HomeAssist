"use client";

import * as React from "react";
import { CenterModal } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Real URL-extraction (fetch the page, parse name/price/image) isn't
 * built — that's retailer-scraping-adjacent work explicitly out of scope
 * for this phase. Rather than fake a successful import, this is honest
 * about that and hands off to the manual "Watch Product" form.
 *
 * Mounted by the parent only while open (see AppChrome) — fresh mount per open.
 */
export function AddUrlModal({
  onClose,
  onFallbackToManual,
}: {
  onClose: () => void;
  onFallbackToManual: (url: string) => void;
}) {
  const [url, setUrl] = React.useState("");

  return (
    <CenterModal open onClose={onClose}>
      <div className="font-serif text-lg">Add Product from Link</div>
      <p className="text-xs text-muted">
        Automatic link import isn&apos;t built yet. Paste the link below and we&apos;ll open the manual
        form with it attached to your notes.
      </p>
      <Input
        placeholder="https://retailer.com/product"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Button className="mt-1" onClick={() => onFallbackToManual(url)}>
        Continue
      </Button>
      <button type="button" onClick={onClose} className="mt-1 cursor-pointer text-[12.5px] text-muted">
        Close
      </button>
    </CenterModal>
  );
}
