"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CenterModal } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shell/toast-context";
import { submitAddSpec, type SpecDraft } from "@/lib/actions/watch-actions";

const EMPTY: SpecDraft = { title: "", brands: "", requirements: "", maxPrice: "" };
const fieldClass =
  "mt-[3px] block w-full rounded-lg border border-line bg-cream px-2.5 py-2 text-[13px] text-ink outline-none";
const labelClass = "text-[11px] text-muted";

// Mounted by the parent only while open (see AppChrome) — fresh mount per open.
export function AddSpecModal({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = React.useState<SpecDraft>(EMPTY);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const showToast = useToast();

  function set<K extends keyof SpecDraft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      const res = await submitAddSpec(draft);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      showToast(`Watching for ${draft.title}`);
      onClose();
      router.refresh();
    });
  }

  return (
    <CenterModal open onClose={onClose}>
      <div className="font-serif text-lg">Watch by Specs</div>
      <p className="text-xs text-muted">Not sure which exact product yet? Describe what you need.</p>
      <label className={labelClass}>
        What are you looking for?
        <input
          className={fieldClass}
          placeholder="e.g. 77-inch OLED TV"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </label>
      <label className={labelClass}>
        Preferred brands
        <input
          className={fieldClass}
          placeholder="e.g. LG, Sony"
          value={draft.brands}
          onChange={(e) => set("brands", e.target.value)}
        />
      </label>
      <label className={labelClass}>
        Requirements
        <textarea
          className={fieldClass}
          rows={2}
          placeholder="OLED, 120Hz+, Dolby Vision"
          value={draft.requirements}
          onChange={(e) => set("requirements", e.target.value)}
        />
      </label>
      <label className={labelClass}>
        Maximum price
        <input
          className={fieldClass}
          placeholder="$2,500"
          value={draft.maxPrice}
          onChange={(e) => set("maxPrice", e.target.value)}
        />
      </label>
      <div className="mt-1.5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-[2]" disabled={pending} onClick={submit}>
          Watch For Sale
        </Button>
      </div>
    </CenterModal>
  );
}
