"use client";

import * as React from "react";
import { HeroImage } from "@/components/ui/hero-image";
import { ProductImage } from "@/components/ui/product-image";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { WatchItemDetailModal } from "@/components/shell/watch-item-detail-modal";
import { useAppShell } from "@/components/shell/app-shell-context";
import { formatCents } from "@/lib/money";
import type { Department } from "@/lib/data/departments";
import type { WatchItem } from "@/lib/data/watch";
import type { OwnedProduct } from "@/lib/data/owned";
import type { PantryProduct } from "@/lib/data/pantry";

export function DepartmentView({
  dept,
  heroSrc,
  watchItems,
  ownedItems,
  regularBuys,
}: {
  dept: Department;
  heroSrc: string;
  watchItems: WatchItem[];
  ownedItems: OwnedProduct[];
  regularBuys: PantryProduct[];
}) {
  const [selected, setSelected] = React.useState<WatchItem | null>(null);
  const { openAddWatch } = useAppShell();
  const isEmpty = watchItems.length === 0 && ownedItems.length === 0 && regularBuys.length === 0;

  return (
    <div className="pb-8">
      <HeroImage src={heroSrc} alt={dept.hero_placeholder} height={170} tabletHeight={260} radiusClassName="rounded-b-(--radius-xl)" />
      <div className="px-5 pt-3.5 pb-1">
        <div className="font-serif text-2xl">{dept.name}</div>
      </div>

      {watchItems.length > 0 ? (
        <>
          <div className="px-5 pt-3.5 pb-2">
            <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">Being Watched</div>
          </div>
          <div className="flex flex-col gap-2 px-5">
            {watchItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="flex items-center gap-2.5 rounded-(--radius-sm) border border-line bg-white p-3 text-left shadow-(--shadow-card)"
              >
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold">{item.title}</div>
                  {item.retailer_name ? <div className="text-[11px] text-muted">{item.retailer_name}</div> : null}
                </div>
                <StatusBadge status={item.price_status} />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {ownedItems.length > 0 ? (
        <>
          <div className="px-5 pt-3.5 pb-2">
            <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">Owned</div>
          </div>
          <div className="flex flex-col gap-2 px-5">
            {ownedItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2.5 rounded-(--radius-sm) border border-line bg-white p-3 shadow-(--shadow-card)">
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold">{item.name}</div>
                  <div className="text-[11px] text-muted">
                    {[item.retailer_name, item.purchase_date && `purchased ${item.purchase_date}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {item.warranty_until ? (
                  <span className="text-[10px] font-semibold text-green">Warranty to {item.warranty_until}</span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {regularBuys.length > 0 ? (
        <>
          <div className="px-5 pt-3.5 pb-2">
            <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">Regular Buys</div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 px-5">
            {regularBuys.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-(--radius-md) border border-line bg-white shadow-(--shadow-card)">
                <ProductImage src={item.image_url} alt={item.title} height={88} tabletHeight={132} />
                <div className="p-3">
                  <div className="text-[13px] font-semibold leading-tight">{item.title}</div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold text-oak">{formatCents(item.target_price_cents)}</span>
                    {item.stock_status ? (
                      <span className="text-[10px] font-semibold" style={{ color: item.stock_status === "low" ? "#b5482f" : "#4C8A63" }}>
                        {item.stock_status === "low" ? "Low" : "Good"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {isEmpty ? (
        <div className="px-5 py-8 text-center text-[13px] text-muted">
          Nothing tracked here yet. Save or watch a piece for {dept.name} and it&apos;ll show up here.
        </div>
      ) : null}

      <div className="mt-5 px-5">
        <Button size="lg" className="w-full" onClick={() => openAddWatch("watch", dept.key)}>
          + Add to {dept.name}
        </Button>
      </div>

      <WatchItemDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
