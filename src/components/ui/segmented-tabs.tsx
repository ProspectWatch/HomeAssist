import { cn } from "@/lib/utils";

export interface TabOption<T extends string> {
  key: T;
  label: string;
}

/** Pill tab group inside one rounded white container (Shop: List/Pantry/Deals/Recipes). */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: TabOption<T>[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex w-fit rounded-(--radius-xl) border border-line bg-white p-[3px] shadow-(--shadow-card)",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              "cursor-pointer rounded-2xl px-3.5 py-1.5 text-xs font-semibold transition-colors",
              active ? "bg-ink text-white" : "bg-transparent text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Row of individually outlined pill chips (Watch filter tabs, Deal filter chips, Pantry group filters). */
export function ChipTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: TabOption<T>[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1.5 overflow-x-auto", className)}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              "shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap",
              active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
