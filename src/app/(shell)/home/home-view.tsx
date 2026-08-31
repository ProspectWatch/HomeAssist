"use client";

import Link from "next/link";
import { Search, Bell, Plus, Camera, Tag, Eye } from "lucide-react";
import { HeroImage } from "@/components/ui/hero-image";
import { ProductImage } from "@/components/ui/product-image";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAppShell } from "@/components/shell/app-shell-context";
import { useToast } from "@/components/shell/toast-context";
import { HOME_HERO_IMAGE, DEPARTMENT_HERO_IMAGES, productImage } from "@/lib/assets";
import { formatCents } from "@/lib/money";
import type { HomeStats } from "@/lib/data/home";
import type { BestPrice } from "@/lib/data/deals";
import type { WatchItem } from "@/lib/data/watch";
import type { DepartmentSummary } from "@/lib/data/departments";
import type { ShoppingPlanResult } from "@/lib/shopping/types";
import type { InventoryCounts } from "@/lib/data/inventory";

export function HomeView({
  stats,
  deals,
  watching,
  departments,
  shoppingPlan,
  inventory,
}: {
  stats: HomeStats;
  deals: BestPrice[];
  watching: WatchItem[];
  departments: DepartmentSummary[];
  shoppingPlan: ShoppingPlanResult;
  inventory: InventoryCounts;
}) {
  const { openAddWatch } = useAppShell();
  const showToast = useToast();

  return (
    <div className="pb-6">
      <div className="flex items-start justify-between px-5 pt-4 pb-3.5">
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 21V10" stroke="var(--color-sage)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M12 10c0-4-3-7-7-7 0 4 3 7 7 7z" stroke="var(--color-sage)" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M12 14c0-3.5 2.6-6 6-6 0 3.5-2.6 6-6 6z" stroke="var(--color-sage)" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="text-[10.5px] font-semibold tracking-[0.16em] text-oak uppercase">Brown Family</div>
            <div className="mt-px font-serif text-[26px] leading-[1.1] text-ink">Good morning</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/search"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white"
          >
            <Search className="h-4 w-4 text-walnut" />
          </Link>
          <Link
            href="/notifications"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white"
          >
            <Bell className="h-4 w-4 text-walnut" />
          </Link>
        </div>
      </div>

      <div className="mx-5 mb-3.5">
        <HeroImage src={HOME_HERO_IMAGE} alt="Kitchen" height={220} radiusClassName="rounded-(--radius-xl)" overlay="fade" priority />
      </div>

      <div className="mx-5 mb-3 grid grid-cols-2 gap-2">
        <Link href="/shop/list" className="rounded-(--radius-md) border border-line bg-white p-3.5 shadow-(--shadow-card)">
          <div className="font-serif text-[21px]">{stats.activeGroceryCount}</div>
          <div className="text-[11px] text-muted">items on the list</div>
        </Link>
        <Link href="/shop/pantry" className="rounded-(--radius-md) border border-line bg-white p-3.5 shadow-(--shadow-card)">
          <div className="font-serif text-[21px]">{inventory.low}</div>
          <div className="text-[11px] text-muted">running low</div>
        </Link>
        <Link href="/shop/pantry" className="rounded-(--radius-md) border border-line bg-white p-3.5 shadow-(--shadow-card)">
          <div className="font-serif text-[21px]">{inventory.out}</div>
          <div className="text-[11px] text-muted">out of stock</div>
        </Link>
        <Link href="/watch" className="rounded-(--radius-md) border border-line bg-white p-3.5 shadow-(--shadow-card)">
          <div className="font-serif text-[21px]">{stats.watchCount}</div>
          <div className="text-[11px] text-muted">products on watch</div>
        </Link>
        <Link href="/receipts" className="rounded-(--radius-md) border border-line bg-white p-3.5 shadow-(--shadow-card)">
          <div className="font-serif text-[15px]">{stats.lastReceipt?.store ?? "No receipts yet"}</div>
          <div className="text-[11px] text-muted">
            {stats.lastReceipt ? `${formatCents(stats.lastReceipt.total_cents)} · recent purchase` : "Scan one to get started"}
          </div>
        </Link>
      </div>

      <div className="mx-5 mb-4 grid grid-cols-4 gap-1.5">
        <QuickAction icon={Plus} label="Add Item" href="/shop/list" />
        <QuickAction
          icon={Camera}
          label="Scan Receipt"
          href="/receipts"
          onClick={() => showToast("Camera would open here")}
        />
        <QuickAction icon={Tag} label="Check Price" href="/shop/deals" />
        <QuickAction icon={Eye} label="Add to Watch" onClick={() => openAddWatch("watch")} />
      </div>

      <div className="slate-plan-card mx-5 mb-4 rounded-(--radius-lg) p-3.5 text-white">
        <div className="mb-2.5 flex items-baseline justify-between">
          <div className="font-serif text-[15px]">This Week&apos;s Shopping Plan</div>
        </div>
        <p className="text-[12px] text-white/70">{shoppingPlan.summary}</p>
      </div>

      <SectionHeader title="Best Prices You've Found" href="/shop/deals" />
      {deals.length === 0 ? (
        <p className="mb-4.5 px-5 text-[12.5px] text-muted">
          Nothing to compare yet — scan a few receipts and the cheapest place to buy each thing shows up here.
        </p>
      ) : (
        <div className="mb-4.5 flex gap-2.5 overflow-x-auto px-5 pb-1">
          {deals.slice(0, 3).map((deal) => (
            <div key={deal.catalogProductId} className="w-[150px] shrink-0 overflow-hidden rounded-(--radius-md) border border-line bg-white shadow-(--shadow-card)">
              <ProductImage
                src={deal.imageReady ? deal.imageUrl : null}
                alt={deal.name}
                height={100}
                category={deal.category}
              />
              <div className="px-2.5 py-2">
                <div className="text-[12.5px] leading-tight font-semibold">{deal.name}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-green">
                  {formatCents(deal.bestCents)}
                  {deal.bestRetailer ? ` at ${deal.bestRetailer}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionHeader title="Watching" href="/watch" />
      {watching.length === 0 ? (
        <p className="mb-4.5 px-5 text-[12.5px] text-muted">Nothing on watch yet.</p>
      ) : (
        <div className="mb-4.5 flex gap-2.5 overflow-x-auto px-5 pb-1">
          {watching.slice(0, 3).map((item) => (
            <div key={item.id} className="w-[150px] shrink-0 overflow-hidden rounded-(--radius-md) border border-line bg-white shadow-(--shadow-card)">
              <ProductImage src={productImage(item.title)} alt={item.title} height={100} />
              <div className="px-2.5 py-2">
                <div className="text-[12.5px] leading-tight font-semibold">{item.title}</div>
                <div className="mt-1.5">
                  <StatusBadge status={item.price_status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionHeader title="Your Home" href="/rooms" />
      <div className="grid grid-cols-3 gap-2 px-5">
        {departments.slice(0, 3).map((dept) => (
          <Link
            key={dept.key}
            href={dept.key === "kitchen" ? "/shop/pantry" : dept.key === "sports" ? "/rooms/sports" : `/rooms/${dept.key}`}
            className="overflow-hidden rounded-(--radius-sm) border border-line bg-white"
          >
            <HeroImage src={DEPARTMENT_HERO_IMAGES[dept.key]} alt={dept.hero_placeholder} height={64} radiusClassName="rounded-none" />
            <div className="px-2 py-1.5">
              <div className="text-[10.5px] leading-tight font-semibold">{dept.name}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between px-5">
      <div className="text-sm font-semibold">{title}</div>
      <Link href={href} className="text-xs font-semibold">
        See all
      </Link>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white">
        <Icon className="h-[18px] w-[18px] text-ink" />
      </div>
      <div className="text-center text-[10px] text-ink">{label}</div>
    </>
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className="flex flex-col items-center gap-1.5 px-0.5 py-1.5">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="flex cursor-pointer flex-col items-center gap-1.5 px-0.5 py-1.5">
      {inner}
    </button>
  );
}
