"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Eye, Sofa, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/watch", label: "Watch", icon: Eye },
  { href: "/rooms", label: "Rooms", icon: Sofa },
  { href: "/more", label: "More", icon: Menu },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-surface-200 bg-surface-0/95 backdrop-blur supports-[backdrop-filter]:bg-surface-0/80"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "var(--shadow-nav)",
      }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[4.25rem] flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-brand-600" : "text-surface-400 hover:text-surface-600",
                )}
              >
                <Icon
                  className="h-6 w-6"
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
