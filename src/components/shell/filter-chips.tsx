"use client";

import { cn } from "@/lib/utils";

/** Horizontally scrolling single-select chip row. One-handed, no dropdowns. */
export function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-2.5">
      <div className="flex gap-1.5 overflow-x-auto px-5 pb-0.5" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={cn(
              "shrink-0 rounded-full border px-3 py-2 text-[12.5px] font-semibold whitespace-nowrap transition-colors",
              value === option ? "border-ink bg-ink text-white" : "border-line bg-white text-muted",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
