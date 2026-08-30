"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InventoryStatus } from "@/lib/data/inventory";

/**
 * The one-tap row used everywhere inventory is set. Buttons are full-height
 * and evenly split so the whole thing is usable one-handed while standing in
 * front of an open fridge — no menus, no modals, no typing.
 */
const OPTIONS: { status: Exclude<InventoryStatus, "UNKNOWN">; label: string; activeClass: string }[] = [
  { status: "IN_STOCK", label: "Have it", activeClass: "border-[#4C8A63] bg-[#4C8A63] text-white" },
  { status: "LOW", label: "Low", activeClass: "border-oak bg-oak text-white" },
  { status: "OUT", label: "Out", activeClass: "border-[#b5482f] bg-[#b5482f] text-white" },
];

export function StatusActions({
  status,
  onList,
  disabled,
  onSetStatus,
  onAddToList,
}: {
  status: InventoryStatus;
  onList: boolean;
  disabled?: boolean;
  onSetStatus: (next: InventoryStatus) => void;
  onAddToList: () => void;
}) {
  // Adding to the list is offered — never done silently — once the household
  // says it's low or out (§9).
  const suggestList = status === "LOW" || status === "OUT";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        {OPTIONS.map((option) => (
          <button
            key={option.status}
            type="button"
            disabled={disabled}
            aria-pressed={status === option.status}
            onClick={() => onSetStatus(option.status)}
            className={cn(
              "min-h-11 flex-1 rounded-(--radius-sm) border text-[13px] font-semibold transition-colors disabled:opacity-60",
              status === option.status ? option.activeClass : "border-line bg-cream text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {onList ? (
        <div className="flex min-h-9 items-center justify-center gap-1.5 rounded-(--radius-sm) bg-cream text-[12.5px] font-semibold text-oak">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          On list
        </div>
      ) : suggestList ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onAddToList}
          className="min-h-11 w-full rounded-(--radius-sm) border border-ink bg-white text-[13px] font-semibold text-ink disabled:opacity-60"
        >
          Add to list
        </button>
      ) : null}
    </div>
  );
}
