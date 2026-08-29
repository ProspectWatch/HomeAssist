"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CenterModal } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/shell/toast-context";
import { formatCents } from "@/lib/money";
import type { WatchItem } from "@/lib/data/watch";
import { markWatchItemPurchased } from "@/lib/actions/watch-actions";

export function WatchItemDetailModal({ item, onClose }: { item: WatchItem | null; onClose: () => void }) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const showToast = useToast();

  function handleMarkPurchased() {
    if (!item) return;
    startTransition(async () => {
      const res = await markWatchItemPurchased(item.id);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      showToast(`${item.title} moved to Owned`);
      onClose();
      router.refresh();
    });
  }

  return (
    <CenterModal open={!!item} onClose={onClose}>
      {item ? (
        <>
          <div>
            <StatusBadge status={item.price_status} />
            <div className="mt-2 font-serif text-[19px]">{item.title}</div>
            <div className="text-[12.5px] text-muted">
              {[item.category, item.retailer_name].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-cream px-1 py-2.5 text-center">
            <div>
              <div className="text-[14px] font-semibold">{formatCents(item.current_price_cents)}</div>
              <div className="text-[10px] text-muted">Current</div>
            </div>
            <div>
              <div className="text-[14px] font-semibold">{formatCents(item.regular_price_cents)}</div>
              <div className="text-[10px] text-muted">Regular</div>
            </div>
            <div>
              <div className="text-[14px] font-semibold">{formatCents(item.target_price_cents)}</div>
              <div className="text-[10px] text-muted">Target</div>
            </div>
          </div>
          <div className="text-[11.5px] text-muted">
            Lowest ever seen: <b className="text-ink">{formatCents(item.lowest_price_cents)}</b>
          </div>
          {item.athlete_name ? (
            <div className="text-[11.5px] text-muted">
              For: <b className="text-ink">{item.athlete_name}</b>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button variant="accent" className="flex-1" disabled={pending} onClick={handleMarkPurchased}>
              Mark Purchased
            </Button>
            <Button variant="outline" className="flex-1">
              Edit Watch
            </Button>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer py-1.5 text-[12.5px] text-muted">
            Close
          </button>
        </>
      ) : null}
    </CenterModal>
  );
}
