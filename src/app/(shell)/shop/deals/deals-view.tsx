"use client";

import { ShopTabs } from "@/components/shell/shop-tabs";
import { HeroImage } from "@/components/ui/hero-image";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/shell/toast-context";
import { DEALS_HERO_IMAGE } from "@/lib/assets";
import { formatCents } from "@/lib/money";
import type { Deal } from "@/lib/data/deals";
import { Tag } from "lucide-react";

export function DealsView({ deals, lastScanTime }: { deals: Deal[]; lastScanTime: string | null }) {
  const showToast = useToast();

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-2.5">
        <h1 className="font-serif text-[26px] leading-tight text-ink">Deals</h1>
      </div>
      <ShopTabs current="/shop/deals" />

      <div className="mx-5 mb-3 flex items-center justify-between rounded-(--radius-sm) border border-line bg-white px-3.5 py-2.5 shadow-(--shadow-card)">
        <div className="text-[11.5px] text-muted">
          Last scan{" "}
          <span className="font-semibold text-ink">
            {lastScanTime ? new Date(lastScanTime).toLocaleString() : "never — scanning isn't built yet"}
          </span>
        </div>
        <button
          type="button"
          className="cursor-pointer text-[11.5px] font-semibold"
          onClick={() => showToast("Retailer deal scanning isn't built yet")}
        >
          Scan again
        </button>
      </div>

      <div className="mx-5 mb-3.5">
        <HeroImage src={DEALS_HERO_IMAGE} alt="Deals" height={150} radiusClassName="rounded-(--radius-lg)" />
      </div>

      {deals.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={Tag}
            title="No deals yet"
            description="Deals show up here once retailer scanning is turned on — it isn't in this build."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3.5 px-5">
          {deals.map((deal) => (
            <div key={deal.id} className="overflow-hidden rounded-(--radius-lg) border border-line bg-white shadow-(--shadow-card)">
              <div className="p-3.5">
                <div className="font-serif text-base font-semibold">{deal.title}</div>
                {deal.retailer_name ? <div className="mt-0.5 text-xs text-muted">{deal.retailer_name}</div> : null}
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-green">{formatCents(deal.price_cents)}</span>
                  {deal.regular_price_cents ? (
                    <span className="text-xs text-muted2 line-through">{formatCents(deal.regular_price_cents)}</span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
