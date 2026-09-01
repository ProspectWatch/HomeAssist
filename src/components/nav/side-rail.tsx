"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_TABS } from "./bottom-nav";

/**
 * Primary navigation on a tablet.
 *
 * The bottom bar is a phone convention: it works because a phone is held in
 * one hand and the bottom is where the thumb is. On an iPad it is a strip of a
 * large screen spent on five links, at the far edge from wherever the hands
 * are, and the whole app renders as a narrow column above it.
 *
 * Same tabs, same order, same active rule — this is the identical list from
 * bottom-nav, not a second copy that can drift out of step with it.
 */
export function SideRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-50 hidden w-(--rail-width) flex-col border-r border-line bg-white md:flex"
    >
      <div className="px-3 pt-5 pb-3">
        <span className="font-serif text-[15px] leading-tight text-ink">HomeAssist</span>
      </div>
      <ul className="flex flex-col gap-0.5 px-2">
        {NAV_TABS.map(({ href, label, icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-(--radius-sm) px-2.5 py-2.5 text-[13px] font-semibold",
                  active ? "bg-cream text-green" : "text-[#9b9797] hover:bg-cream",
                )}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                  {icon}
                </svg>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
