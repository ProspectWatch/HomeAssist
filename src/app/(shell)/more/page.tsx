import Link from "next/link";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

const LINKS = [
  // Family leads: it is the thing that was asked for twice and found neither
  // time, because it lived inside a page the menu called "Search Settings".
  { href: "/family", label: "Family" },
  { href: "/shop/plan", label: "Meal Plan" },
  { href: "/shop/recipes", label: "Recipes" },
  { href: "/stores", label: "Stores" },
  { href: "/receipts", label: "Receipts" },
  { href: "/price-history", label: "Price Book" },
  { href: "/image-credits", label: "Image Credits" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings", label: "Settings" },
] as const;

export default function MorePage() {
  return (
    <>
      <TopBar title="More" />
      <div className="px-5">
        <Card className="divide-y divide-line overflow-hidden">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left"
            >
              <span className="text-[15px] font-medium text-ink">{label}</span>
              <ChevronRight className="h-4 w-4 text-muted2" aria-hidden="true" />
            </Link>
          ))}
        </Card>
      </div>
    </>
  );
}
