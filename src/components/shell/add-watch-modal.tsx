"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CenterModal } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shell/toast-context";
import { submitAddOwned, submitAddWatch, type OwnDraft, type WatchDraft } from "@/lib/actions/watch-actions";
import type { Department } from "@/lib/data/departments";
import type { Athlete } from "@/lib/data/athletes";

const EMPTY_WATCH: WatchDraft = {
  name: "",
  category: "",
  dept: "hometech",
  retailer: "",
  current: "",
  target: "",
  needBy: "",
  notes: "",
  athleteId: "",
  size: "",
  fit: "",
};

const fieldClass =
  "mt-[3px] block w-full rounded-lg border border-line bg-cream px-2.5 py-2 text-[13px] text-ink outline-none";
const labelClass = "text-[11px] text-muted";

/**
 * Mounted by the parent only while open (see AppChrome) — so each open is a
 * fresh mount and `useState` below already gives a clean draft, with no
 * "reset on open" effect needed.
 */
export function AddWatchModal({
  onClose,
  departments,
  athletes,
  initialMode = "watch",
  initialUrl,
}: {
  onClose: () => void;
  departments: Department[];
  athletes: Athlete[];
  initialMode?: "watch" | "own";
  initialUrl?: string;
}) {
  const [mode, setMode] = React.useState<"watch" | "own">(initialMode);
  const [draft, setDraft] = React.useState<WatchDraft>(() => ({
    ...EMPTY_WATCH,
    notes: initialUrl ? `Link: ${initialUrl}` : "",
  }));
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const showToast = useToast();

  function set<K extends keyof WatchDraft>(key: K, value: WatchDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      const res =
        mode === "own"
          ? await submitAddOwned({
              name: draft.name,
              category: draft.category,
              dept: draft.dept,
              retailer: draft.retailer,
              purchasePrice: draft.current,
              purchaseDate: draft.needBy,
              warrantyUntil: draft.target,
            } satisfies OwnDraft)
          : await submitAddWatch(draft);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      showToast(mode === "own" ? `${draft.name} added to Owned` : `Now watching ${draft.name}`);
      onClose();
      router.refresh();
    });
  }

  return (
    <CenterModal open onClose={onClose}>
      <div className="mb-1 flex gap-[3px] rounded-[20px] bg-cream p-[3px]">
        <button
          type="button"
          onClick={() => setMode("watch")}
          className={`flex-1 cursor-pointer rounded-2xl py-1.5 text-[12.5px] font-semibold ${mode === "watch" ? "bg-ink text-white" : "text-ink"}`}
        >
          Watching
        </button>
        <button
          type="button"
          onClick={() => setMode("own")}
          className={`flex-1 cursor-pointer rounded-2xl py-1.5 text-[12.5px] font-semibold ${mode === "own" ? "bg-ink text-white" : "text-ink"}`}
        >
          Already Own
        </button>
      </div>

      <label className={labelClass}>
        Product name
        <input className={fieldClass} value={draft.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <div className="flex gap-2">
        <label className={`flex-1 ${labelClass}`}>
          Category
          <input className={fieldClass} value={draft.category} onChange={(e) => set("category", e.target.value)} />
        </label>
        <label className={`flex-1 ${labelClass}`}>
          Department
          <select className={fieldClass} value={draft.dept} onChange={(e) => set("dept", e.target.value)}>
            {departments.map((d) => (
              <option key={d.key} value={d.key}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={labelClass}>
        Retailer
        <input className={fieldClass} value={draft.retailer} onChange={(e) => set("retailer", e.target.value)} />
      </label>

      {draft.dept === "sports" && mode === "watch" ? (
        <>
          <label className={labelClass}>
            Athlete
            <select className={fieldClass} value={draft.athleteId} onChange={(e) => set("athleteId", e.target.value)}>
              <option value="">Select…</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <label className={`flex-1 ${labelClass}`}>
              Size
              <input className={fieldClass} value={draft.size} onChange={(e) => set("size", e.target.value)} />
            </label>
            <label className={`flex-1 ${labelClass}`}>
              Fit
              <input className={fieldClass} value={draft.fit} onChange={(e) => set("fit", e.target.value)} />
            </label>
          </div>
        </>
      ) : null}

      {mode === "watch" ? (
        <>
          <div className="flex gap-2">
            <label className={`flex-1 ${labelClass}`}>
              Current price
              <input className={fieldClass} value={draft.current} onChange={(e) => set("current", e.target.value)} />
            </label>
            <label className={`flex-1 ${labelClass}`}>
              Target price
              <input className={fieldClass} value={draft.target} onChange={(e) => set("target", e.target.value)} />
            </label>
          </div>
          <label className={labelClass}>
            Need by
            <input className={fieldClass} value={draft.needBy} onChange={(e) => set("needBy", e.target.value)} />
          </label>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <label className={`flex-1 ${labelClass}`}>
              Purchase price
              <input className={fieldClass} value={draft.current} onChange={(e) => set("current", e.target.value)} />
            </label>
            <label className={`flex-1 ${labelClass}`}>
              Purchase date
              <input className={fieldClass} value={draft.needBy} onChange={(e) => set("needBy", e.target.value)} />
            </label>
          </div>
          <label className={labelClass}>
            Warranty until
            <input className={fieldClass} value={draft.target} onChange={(e) => set("target", e.target.value)} />
          </label>
        </>
      )}
      <label className={labelClass}>
        Notes
        <textarea className={fieldClass} rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>

      <div className="mt-1.5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-[2]" disabled={pending} onClick={submit}>
          {mode === "own" ? "Add to Owned" : "Watch For Sale"}
        </Button>
      </div>
    </CenterModal>
  );
}
