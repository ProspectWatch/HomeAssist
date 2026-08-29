"use client";

import * as React from "react";
import { HeroImage } from "@/components/ui/hero-image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/shell/toast-context";
import { storeBadge, RECEIPTS_HERO_IMAGE } from "@/lib/assets";
import { formatCents } from "@/lib/money";
import type { Receipt } from "@/lib/data/receipts";
import { Receipt as ReceiptIcon } from "lucide-react";

export function ReceiptsView({ receipts }: { receipts: Receipt[] }) {
  const [search, setSearch] = React.useState("");
  const showToast = useToast();

  const filtered = receipts.filter((r) => (r.retailer_name ?? "").toLowerCase().includes(search.toLowerCase()));
  const groups = new Map<string, Receipt[]>();
  for (const r of filtered) {
    const label = new Date(r.purchased_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    groups.set(label, [...(groups.get(label) ?? []), r]);
  }

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-3.5">
        <h1 className="mb-3 font-serif text-[26px] leading-tight text-ink">Receipts</h1>
        <div className="mb-3">
          <HeroImage src={RECEIPTS_HERO_IMAGE} alt="Receipts" height={150} radiusClassName="rounded-(--radius-lg)" />
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search receipts"
          className="mb-3"
        />
        <Button size="lg" className="w-full" onClick={() => showToast("Camera would open here")}>
          Scan Receipt
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={ReceiptIcon}
            title="No receipts yet"
            description="Scan a receipt or log a purchase to start building price history."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4.5 px-5">
          {[...groups.entries()].map(([label, items]) => (
            <div key={label}>
              <div className="mb-2 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">{label}</div>
              <div className="flex flex-col gap-2">
                {items.map((r) => {
                  const badge = storeBadge(r.retailer_name);
                  return (
                    <div key={r.id} className="flex items-center gap-2.5 rounded-(--radius-sm) border border-line bg-white p-3 shadow-(--shadow-card)">
                      <span
                        className="rounded-[6px] px-2 py-[3px] text-[10px]"
                        style={{ background: badge.bg, color: badge.color, border: badge.border }}
                      >
                        {r.retailer_name ?? "—"}
                      </span>
                      <div className="flex-1">
                        <div className="text-[13.5px] font-semibold">{r.retailer_name ?? "Unknown store"}</div>
                        <div className="text-[11px] text-muted">
                          {new Date(r.purchased_at).toLocaleDateString()} · {r.item_count} items
                        </div>
                      </div>
                      <div className="font-serif text-sm font-semibold">{formatCents(r.total_cents)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
