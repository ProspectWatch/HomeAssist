"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/home",
    label: "Home",
    match: (p: string) => p === "/home",
    icon: (
      <path
        d="M3 11L12 4l9 7M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  {
    href: "/shop/list",
    label: "Shop",
    match: (p: string) => p.startsWith("/shop"),
    icon: (
      <>
        <path
          d="M6 8h13l-1.5 10a2 2 0 0 1-2 1.7H9.5a2 2 0 0 1-2-1.7L6 8z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
  },
  {
    href: "/watch",
    label: "Watch",
    match: (p: string) => p.startsWith("/watch"),
    icon: (
      <>
        <path
          d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
  },
  {
    href: "/rooms",
    label: "Rooms",
    match: (p: string) => p.startsWith("/rooms"),
    icon: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <rect x="13" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <rect x="4" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <rect x="13" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
  },
  {
    href: "/more",
    label: "More",
    match: (p: string) =>
      p.startsWith("/more") ||
      ["/stores", "/receipts", "/price-history", "/notifications", "/settings"].some((r) =>
        p.startsWith(r),
      ),
    icon: (
      <>
        <circle cx="5" cy="12" r="1.6" fill="currentColor" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        <circle cx="19" cy="12" r="1.6" fill="currentColor" />
      </>
    ),
  },
] as const;

export { TABS as NAV_TABS };

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      // Below the tablet breakpoint only. On a wider screen the side rail
      // takes over: a bar pinned to the bottom of an iPad is a long way from
      // anywhere your hands are, and it spends a strip of a large screen on
      // five links.
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-1 pt-2 pb-1">
        {TABS.map(({ href, label, icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-[3px] px-2 py-1",
                  active ? "text-green" : "text-[#9b9797]",
                )}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
                  {icon}
                </svg>
                <span className="text-[10px]">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
