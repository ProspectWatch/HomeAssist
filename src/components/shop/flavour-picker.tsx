"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";

/**
 * Which flavour we want, chosen at the list rather than at the deal.
 *
 * Deals are found by brand — a Doritos offer is a Doritos offer — so the
 * flavour is not a matching question, it is a shopping one, and it is asked
 * here where somebody is deciding what to put in the trolley. More than one
 * can be picked: the reason a bag is on offer is often the reason to buy two
 * different ones.
 *
 * The options are the flavours this household has actually recorded owning.
 * Anything else is typed in, and nothing is suggested that nobody here has
 * ever bought.
 */
export function FlavourPicker({
  open,
  itemName,
  brand,
  options,
  selected,
  onClose,
  onSave,
}: {
  open: boolean;
  itemName: string;
  brand: string | null;
  options: string[];
  selected: string[];
  onClose: () => void;
  onSave: (variants: string[]) => void;
}) {
  // Seeded from props at mount; the caller remounts with a key when it opens
  // a different item, so there is no prop-to-state effect to keep in sync.
  const [chosen, setChosen] = React.useState<string[]>(selected);
  const [other, setOther] = React.useState("");

  // Flavours already on the line that aren't in the household's own products —
  // typed in last time, and still worth showing as a chip they can untick.
  const all = React.useMemo(
    () => [...options, ...selected.filter((s) => !options.includes(s))],
    [options, selected],
  );

  function toggle(variant: string) {
    setChosen((prev) =>
      prev.includes(variant) ? prev.filter((v) => v !== variant) : [...prev, variant],
    );
  }

  function addOther() {
    const value = other.trim();
    if (!value) return;
    setChosen((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setOther("");
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="mb-1 text-sm font-semibold">Which one?</div>
      <p className="mb-3 text-[11.5px] leading-snug text-muted">
        {brand
          ? `${brand} deals cover every flavour — pick the ones you actually want for ${itemName}.`
          : `Pick the flavours you want for ${itemName}.`}
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {all.map((variant) => {
          const on = chosen.includes(variant);
          return (
            <button
              key={variant}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(variant)}
              className={
                on
                  ? "cursor-pointer rounded-(--radius-sm) border border-ink bg-ink px-3 py-1.5 text-[12px] font-semibold text-white"
                  : "cursor-pointer rounded-(--radius-sm) border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink"
              }
            >
              {variant}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex gap-2">
        <Input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOther();
            }
          }}
          placeholder="Another flavour"
          className="flex-1"
        />
        <Button variant="outline" disabled={other.trim().length === 0} onClick={addOther}>
          Add
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setChosen([])}>
          Any is fine
        </Button>
        <Button className="flex-1" onClick={() => onSave(chosen)}>
          Save
        </Button>
      </div>
    </BottomSheet>
  );
}
