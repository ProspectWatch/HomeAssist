"use client";

import * as React from "react";
import { ChipTabs } from "@/components/ui/segmented-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { WatchItemDetailModal } from "@/components/shell/watch-item-detail-modal";
import { formatCents } from "@/lib/money";
import type { WatchItem, WatchSpec } from "@/lib/data/watch";

type WatchTab = "all" | "priceDrops" | "targetHit" | "sports" | "home" | "tech";

const HOME_DEPTS = ["furniture", "yard", "appliances", "decor", "bathrooms", "laundry", "cleaning"];

const TABS: { key: WatchTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "priceDrops", label: "Price Drops" },
  { key: "targetHit", label: "Target Hit" },
  { key: "sports", label: "Sports" },
  { key: "home", label: "Home" },
  { key: "tech", label: "Tech" },
];

export function WatchView({ items, specs }: { items: WatchItem[]; specs: WatchSpec[] }) {
  const [tab, setTab] = React.useState<WatchTab>("all");
  const [selected, setSelected] = React.useState<WatchItem | null>(null);

  const filtered = items.filter((w) => {
    if (tab === "priceDrops") return w.price_status === "price_dropped";
    if (tab === "targetHit") return w.price_status === "target_hit" || w.price_status === "all_time_low";
    if (tab === "sports") return w.department_key === "sports";
    if (tab === "home") return !!w.department_key && HOME_DEPTS.includes(w.department_key);
    if (tab === "tech") return w.department_key === "hometech";
    return true;
  });
  const showSpecs = specs.length > 0 && (tab === "all" || tab === "tech");
  const isEmpty = filtered.length === 0 && !showSpecs;

  return (
    <div className="pb-28">
      <div className="px-5 pt-4 pb-3">
        <h1 className="font-serif text-[26px] leading-tight text-ink">Watch List</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {items.length} products · watched until the right price
        </p>
      </div>

      <div className="mb-4 px-5">
        <ChipTabs options={TABS} value={tab} onChange={setTab} />
      </div>

      {showSpecs ? (
        <div className="mb-4 flex flex-col gap-2.5 px-5">
          {specs.map((spec) => (
            <div key={spec.id} className="rounded-(--radius-md) border-[1.5px] border-dashed border-oak bg-white p-3.5">
              <div className="mb-1 text-[10px] font-bold tracking-[0.08em] text-oak uppercase">Watching by spec</div>
              <div className="text-[15px] font-semibold">{spec.title}</div>
              {spec.requirements ? <div className="mt-0.5 text-[11.5px] text-muted">{spec.requirements}</div> : null}
              <div className="mt-1.5 text-[11.5px] font-semibold text-green">Searching for matches…</div>
            </div>
          ))}
        </div>
      ) : null}

      {isEmpty ? (
        <div className="px-5">
          <EmptyState title="Nothing here yet" />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 px-5">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-(--radius-lg) border border-line bg-white p-3.5 shadow-(--shadow-card)">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[15px] font-semibold">{item.title}</div>
                  {item.category ? <div className="mt-0.5 text-[11.5px] text-muted">{item.category}</div> : null}
                </div>
                <StatusBadge status={item.price_status} />
              </div>
              <div className="mt-2.5 flex gap-4">
                <div>
                  <div className="text-base font-semibold">{formatCents(item.current_price_cents)}</div>
                  <div className="text-[10px] text-muted">Current</div>
                </div>
                <div>
                  <div className="text-base font-semibold">{formatCents(item.target_price_cents)}</div>
                  <div className="text-[10px] text-muted">Target</div>
                </div>
                <div>
                  <div className="text-base font-semibold">{formatCents(item.lowest_price_cents)}</div>
                  <div className="text-[10px] text-muted">Lowest Seen</div>
                </div>
              </div>
              {item.retailer_name ? <div className="mt-2 text-[11px] text-muted">{item.retailer_name}</div> : null}
              <div className="mt-2.5 flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelected(item)}>
                  View Product
                </Button>
                <button type="button" className="cursor-pointer text-xs font-semibold" onClick={() => setSelected(item)}>
                  Edit Watch
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <WatchItemDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
