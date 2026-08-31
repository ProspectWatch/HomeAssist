"use client";

import { Plus } from "lucide-react";

/**
 * The way to add something, said out loud.
 *
 * Every screen that holds a list had an unlabelled + icon tucked beside the
 * search field, or — on Watch — nothing at all beyond a floating + that opens
 * a menu of six things. That is findable only if you already know it is there,
 * which is exactly the report: "I still haven't seen where or how I can add an
 * item." A full-width bar that says what it does costs one row and removes
 * the guessing.
 */
export function AddItemBar({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-(--radius-md) border border-dashed border-oak bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:bg-cream"
    >
      <Plus className="h-4 w-4 text-oak" aria-hidden />
      {label}
    </button>
  );
}
