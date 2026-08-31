"use client";

import { useState, useTransition } from "react";

/**
 * Star toggle for a pantry or watch row.
 *
 * Optimistic: the star fills on tap and reverts if the write fails. A favourite
 * is a low-stakes preference, and waiting a round trip to see a star fill makes
 * marking a dozen of them feel broken.
 */
export function FavouriteButton({
  title,
  isFavourite,
  onToggle,
}: {
  title: string;
  isFavourite: boolean;
  onToggle: (next: boolean) => Promise<{ ok: boolean }>;
}) {
  const [on, setOn] = useState(isFavourite);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const res = await onToggle(next);
      if (!res.ok) setOn(!next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from favourites` : `Make ${title} a favourite`}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-[18px] w-[18px] ${on ? "text-oak" : "text-line"}`}
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      >
        <path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z" />
      </svg>
    </button>
  );
}
