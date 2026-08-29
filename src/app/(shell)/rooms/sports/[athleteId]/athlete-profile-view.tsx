"use client";

import * as React from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { WatchItemDetailModal } from "@/components/shell/watch-item-detail-modal";
import type { Athlete } from "@/lib/data/athletes";
import type { WatchItem } from "@/lib/data/watch";

export function AthleteProfileView({
  athlete,
  nextNeeds,
}: {
  athlete: Athlete & { equipment: { id: string; equipment_type: string; item: string }[] };
  nextNeeds: WatchItem[];
}) {
  const [selected, setSelected] = React.useState<WatchItem | null>(null);

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3.5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sage font-serif text-xl font-semibold text-white">
          {athlete.name[0]}
        </div>
        <div>
          <div className="font-serif text-[23px]">{athlete.name}</div>
          {athlete.sport ? <div className="text-[12.5px] text-muted">{athlete.sport}</div> : null}
        </div>
      </div>

      <div className="px-5 pb-2">
        <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">Current Equipment</div>
      </div>
      {athlete.equipment.length === 0 ? (
        <div className="px-5">
          <EmptyState title="No equipment logged yet" />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 px-5">
          {athlete.equipment.map((eq) => (
            <div key={eq.id} className="flex justify-between rounded-(--radius-xs) border border-line bg-white px-3 py-2.5 shadow-(--shadow-card)">
              <span className="text-[11px] font-semibold tracking-[0.04em] text-muted uppercase">{eq.equipment_type}</span>
              <span className="text-[13px]">{eq.item}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 pt-4.5 pb-2">
        <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">Next Needs</div>
      </div>
      {nextNeeds.length === 0 ? (
        <div className="px-5">
          <EmptyState title="Nothing being watched for them yet" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {nextNeeds.map((item) => (
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
      )}

      <WatchItemDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
