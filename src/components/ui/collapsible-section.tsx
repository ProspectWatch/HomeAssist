"use client";

import { useEffect, useState } from "react";

/**
 * A section of a long list that can be folded away.
 *
 * Pantry runs to 213 rows, the list and the watch list to 67 each. Flat, that
 * is a lot of thumb travel to reach anything, and the sticky headers Pantry
 * Check uses only tell you where you are — they don't let you skip. Folding
 * turns the same screen into an index: eight headers you can see at once, and
 * you open the one you are standing in front of.
 *
 * Open/closed is remembered per screen so the shape you left is the shape you
 * come back to. localStorage rather than the database: it is a per-person,
 * per-device convenience, not a household fact, and a private window that
 * forgets it costs nothing. Every access is guarded because a browser set to
 * block site data throws on read rather than returning empty.
 */

function readOpenState(storageKey: string): Record<string, boolean> | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : null;
  } catch {
    return null;
  }
}

export function useSectionState(storageKey: string, defaultOpen: boolean) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setOpen(readOpenState(storageKey) ?? {});
    setLoaded(true);
  }, [storageKey]);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? defaultOpen) };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // A browser that refuses to store this still gets a working toggle for
        // the life of the page; only the memory of it is lost.
      }
      return next;
    });
  }

  // Before the stored state is read, everything renders at its default. This
  // avoids a flash of the wrong shape on first paint.
  const isOpen = (id: string) => (loaded ? (open[id] ?? defaultOpen) : defaultOpen);
  return { isOpen, toggle };
}

export function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="sticky top-0 z-10 flex w-full items-baseline justify-between bg-[#faf8f4]/95 px-5 py-2.5 text-left backdrop-blur"
      >
        <span className="flex items-center gap-1.5">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={`h-3 w-3 shrink-0 text-oak transition-transform ${open ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
            {title}
          </span>
        </span>
        <span className="text-[11px] text-muted2">{count}</span>
      </button>
      {open ? <div className="flex flex-col gap-2 px-5 pt-0.5 pb-2">{children}</div> : null}
    </section>
  );
}
