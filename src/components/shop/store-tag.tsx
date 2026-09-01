"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { storeBadge } from "@/lib/assets";

export type StoreOption = { id: string; name: string };

/**
 * Which store this gets bought at.
 *
 * Two strengths, because the household said it that way: steak is always
 * Marilu's, and once in a while Costco. "Always" becomes the standing
 * preference, so the next time steak goes on a list it arrives tagged. "Once
 * in a while" is recorded as a store that is also fine, and does not displace
 * the usual one — otherwise a single Costco trip would rewrite where you
 * normally shop.
 */
export function StoreTagSheet({
  open,
  itemName,
  stores,
  currentRetailerId,
  onClose,
  onPick,
}: {
  open: boolean;
  itemName: string;
  stores: StoreOption[];
  currentRetailerId: string | null;
  onClose: () => void;
  onPick: (retailerId: string | null, strength: "ALWAYS" | "SOMETIMES" | null) => void;
}) {
  const [picked, setPicked] = React.useState<string | null>(currentRetailerId);

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="mb-1 text-sm font-semibold">Where do you buy {itemName}?</div>
      <p className="mb-3 text-[11.5px] leading-snug text-muted">
        Pick a store, then say whether that&rsquo;s always or just sometimes.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {stores.map((store) => {
          const badge = storeBadge(store.name);
          const on = picked === store.id;
          return (
            <button
              key={store.id}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked(on ? null : store.id)}
              className="cursor-pointer rounded-(--radius-sm) border px-3 py-1.5 text-[12px] font-semibold"
              style={
                on
                  ? { background: badge.bg, color: badge.color, border: badge.border }
                  : { background: "white", color: "var(--color-ink)", borderColor: "var(--color-line)" }
              }
            >
              {store.name}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={picked === null}
          onClick={() => onPick(picked, "SOMETIMES")}
        >
          Sometimes
        </Button>
        <Button className="flex-1" disabled={picked === null} onClick={() => onPick(picked, "ALWAYS")}>
          Always
        </Button>
      </div>

      {currentRetailerId ? (
        <button
          type="button"
          onClick={() => onPick(null, null)}
          className="mt-3 w-full cursor-pointer text-center text-[12px] font-semibold text-muted2"
        >
          Clear the store on this item
        </button>
      ) : null}
    </BottomSheet>
  );
}
