import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/shop/list", label: "List" },
  { href: "/shop/pantry", label: "Pantry" },
  { href: "/shop/deals", label: "Deals" },
  { href: "/shop/recipes", label: "Recipes" },
] as const;

export function ShopTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <div className="mx-5 mb-3.5 inline-flex w-fit rounded-(--radius-xl) border border-line bg-white p-[3px] shadow-(--shadow-card)">
      {TABS.map((tab) => {
        const active = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-2xl px-3.5 py-1.5 text-xs font-semibold",
              active ? "bg-ink text-white" : "text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
