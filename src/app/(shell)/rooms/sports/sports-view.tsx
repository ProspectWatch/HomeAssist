"use client";

import * as React from "react";
import Link from "next/link";
import { HeroImage } from "@/components/ui/hero-image";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { WatchItemDetailModal } from "@/components/shell/watch-item-detail-modal";
import { useAppShell } from "@/components/shell/app-shell-context";
import { DEPARTMENT_HERO_IMAGES } from "@/lib/assets";
import type { Athlete } from "@/lib/data/athletes";
import type { WatchItem } from "@/lib/data/watch";
import { Users } from "lucide-react";

export function SportsView({
  athletes,
  watchCountByAthlete,
  equipmentWatch,
}: {
  athletes: Athlete[];
  watchCountByAthlete: Map<string, number>;
  equipmentWatch: WatchItem[];
}) {
  const [selected, setSelected] = React.useState<WatchItem | null>(null);
  const { openAddWatch } = useAppShell();

  return (
    <div className="pb-8">
      <HeroImage
        src={DEPARTMENT_HERO_IMAGES.sports}
        alt="Mudroom gear room"
        height={170}
        tabletHeight={260}
        radiusClassName="rounded-b-(--radius-xl)"
      />
      <div className="px-5 pt-3.5 pb-1">
        <div className="font-serif text-2xl">Kids Sports</div>
      </div>

      <div className="px-5 pt-3.5 pb-2">
        <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">Athletes</div>
      </div>
      {athletes.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={Users}
            title="No athletes yet"
            description="Add a household athlete to start tracking their gear and sizes."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {athletes.map((a) => (
            <Link
              key={a.id}
              href={`/rooms/sports/${a.id}`}
              className="flex items-center gap-3 rounded-(--radius-md) border border-line bg-white p-3 shadow-(--shadow-card)"
            >
              <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-sage font-serif text-base font-semibold text-white">
                {a.name[0]}
              </div>
              <div className="flex-1">
                <div className="text-[14.5px] font-semibold">{a.name}</div>
                {a.sport ? <div className="text-[11.5px] text-muted">{a.sport}</div> : null}
              </div>
              <span className="text-[11px] font-semibold text-oak">
                {watchCountByAthlete.get(a.id) ?? 0} watching
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="px-5 pt-4.5 pb-2">
        <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">Equipment Watch</div>
      </div>
      {equipmentWatch.length === 0 ? (
        <div className="px-5">
          <EmptyState title="Nothing being watched" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {equipmentWatch.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="flex items-center gap-2.5 rounded-(--radius-sm) border border-line bg-white p-3 text-left shadow-(--shadow-card)"
            >
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold">{item.title}</div>
                <div className="text-[11px] text-muted">
                  {[item.athlete_name, item.retailer_name].filter(Boolean).join(" · ")}
                </div>
              </div>
              <StatusBadge status={item.price_status} />
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 px-5">
        <Button size="lg" className="w-full" onClick={() => openAddWatch("watch", "sports")}>
          + Add Sports Equipment
        </Button>
      </div>

      <WatchItemDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
