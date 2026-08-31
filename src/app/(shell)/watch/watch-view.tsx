"use client";

import * as React from "react";
import { ChipTabs } from "@/components/ui/segmented-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { WatchItemDetailModal } from "@/components/shell/watch-item-detail-modal";
import { ProductImage } from "@/components/ui/product-image";
import { CollapsibleSection, useSectionState } from "@/components/ui/collapsible-section";
import { AddItemBar } from "@/components/ui/add-item-bar";
import { useAppShell } from "@/components/shell/app-shell-context";
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
  const { openAddWatch } = useAppShell();

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

  /**
   * 67 watched products in one scroll is a wall. Grouped by category and
   * folded, with the ones on offer lifted to the top — a watch list exists to
   * tell you when something is worth buying, so what has moved comes first and
   * the rest waits behind a header.
   */
  const groups = React.useMemo(() => {
    const moved = filtered.filter(
      (w) => w.price_status === "price_dropped" || w.price_status === "target_hit" || w.price_status === "all_time_low",
    );
    const byCategory = new Map<string, WatchItem[]>();
    for (const item of filtered) {
      if (moved.includes(item)) continue;
      const key = item.category ?? "Everything else";
      const bucket = byCategory.get(key);
      if (bucket) bucket.push(item);
      else byCategory.set(key, [item]);
    }
    const rest = [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, list]) => ({ id: title, title, items: list, openByDefault: false }));
    return moved.length > 0
      ? [{ id: "__moved", title: "Worth a look", items: moved, openByDefault: true }, ...rest]
      : rest;
  }, [filtered]);

  const sections = useSectionState("watch-sections", false);

  return (
    <div className="pb-28">
      <div className="px-5 pt-4 pb-3">
        <h1 className="font-serif text-[26px] leading-tight text-ink">Watch List</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {items.length} products · watched until the right price
        </p>
      </div>

      {/* Watch had no add button of its own — only the floating + in the
          corner, which opens a menu of six things and never says that one of
          them puts a product here. */}
      <div className="mb-3 px-5">
        <AddItemBar label="Watch a product" onClick={() => openAddWatch("watch")} />
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
          <EmptyState
            title="Nothing here yet"
            description="Use Watch a product above to track something until the price is right."
          />
        </div>
      ) : (
        groups.map((group) => (
          <CollapsibleSection
            key={group.id}
            title={group.title}
            count={group.items.length}
            open={sections.isOpen(group.id) || group.openByDefault}
            onToggle={() => sections.toggle(group.id)}
          >
          {group.items.map((item) => (
            <div key={item.id} className="rounded-(--radius-lg) border border-line bg-white p-3.5 shadow-(--shadow-card)">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="w-12 shrink-0 overflow-hidden rounded-(--radius-sm)">
                    <ProductImage src={item.image_url} alt={item.title} height={48} category={item.category} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold">{item.title}</div>
                    {item.category ? <div className="mt-0.5 text-[11.5px] text-muted">{item.category}</div> : null}
                  </div>
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
              {/* Say where the low came from and how much it rests on. "Lowest
                  seen" off a single sighting is just the only price there has
                  ever been, and reads as a bargain when it is not. */}
              {item.sightings > 0 ? (
                <div className="mt-2 text-[11px] text-muted">
                  {item.lowest_retailer ? `Lowest at ${item.lowest_retailer}` : "Lowest seen"}
                  {` · ${item.sightings} ${item.sightings === 1 ? "sighting" : "sightings"}`}
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-muted">No price seen yet — next scan will look</div>
              )}
              {item.retailer_name ? <div className="mt-1 text-[11px] text-muted">{item.retailer_name}</div> : null}
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
          </CollapsibleSection>
        ))
      )}

      <WatchItemDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
