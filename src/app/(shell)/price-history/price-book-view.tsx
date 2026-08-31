"use client";

import * as React from "react";
import Link from "next/link";
import { LineChart, Search } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";
import type { PriceBookRow } from "@/lib/data/price-book";

function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The price book. One row per product the household has a real price for,
 * most recent first. Everything shown here was paid or observed — there are
 * no modelled or estimated prices, and a product with no sightings simply
 * isn't in the list.
 */
export function PriceBookView({ rows }: { rows: PriceBookRow[] }) {
  const [filter, setFilter] = React.useState("");
  const [regularsOnly, setRegularsOnly] = React.useState(false);

  const query = filter.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (regularsOnly && !row.isRegularBuy) return false;
    if (!query) return true;
    return (
      row.name.toLowerCase().includes(query) ||
      row.category.toLowerCase().includes(query) ||
      (row.brand ?? "").toLowerCase().includes(query) ||
      row.retailers.some((r) => r.name.toLowerCase().includes(query))
    );
  });

  const regularCount = rows.filter((r) => r.isRegularBuy).length;

  if (rows.length === 0) {
    return (
      <div className="px-5">
        <EmptyState
          icon={LineChart}
          title="No prices recorded yet"
          description="Scan a receipt and every line on it lands here — what you paid, where, and when. That record is what lets the app tell you whether a price is a good one."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 px-5">
      <div className="rounded-(--radius-sm) border border-line bg-white px-3.5 py-2.5 text-[11.5px] text-muted shadow-(--shadow-card)">
        <span className="font-semibold text-ink">{rows.length}</span>{" "}
        {rows.length === 1 ? "product" : "products"} with a real price on file
        {regularCount > 0 ? (
          <>
            {" · "}
            <span className="font-semibold text-ink">{regularCount}</span> of them regular buys
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search your prices"
          aria-label="Search your prices"
        />
        <button
          type="button"
          onClick={() => setRegularsOnly((v) => !v)}
          aria-pressed={regularsOnly}
          className={`shrink-0 cursor-pointer rounded-(--radius-sm) border px-3 py-2 text-[11.5px] font-semibold ${
            regularsOnly ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"
          }`}
        >
          Regulars
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches" description="Try a different product, brand or store." />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((row) => (
            <div
              key={row.catalogProductId}
              className="flex gap-3 rounded-(--radius-md) border border-line bg-white p-3 shadow-(--shadow-card)"
            >
              <ProductImage
                src={row.imageReady ? row.imageUrl : null}
                alt={row.name}
                height={56}
                category={row.category}
                className="w-14 shrink-0 overflow-hidden rounded-(--radius-sm) border border-line"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{row.name}</div>
                    {row.brand ? <div className="truncate text-[11px] text-muted">{row.brand}</div> : null}
                  </div>
                  {row.isRegularBuy ? <Badge variant="oak">Regular</Badge> : null}
                </div>

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11.5px]">
                  {/* With one or two sightings there is no "usual" price to
                      report, so the row shows what was paid instead of a
                      median dressed up as a typical price. */}
                  {row.confidence === "THIN" ? (
                    <span className="text-muted">
                      Paid <span className="font-semibold text-ink">{formatCents(row.lastCents)}</span>
                    </span>
                  ) : (
                    <>
                      <span className="text-muted">
                        Usually <span className="font-semibold text-ink">{formatCents(row.typicalCents)}</span>
                      </span>
                      <span className="text-muted">
                        Best <span className="font-semibold text-green">{formatCents(row.lowestCents)}</span>
                        {row.lowestRetailer ? ` at ${row.lowestRetailer}` : ""}
                      </span>
                    </>
                  )}
                </div>

                <div className="text-[11px] text-muted2">
                  Last {formatCents(row.lastCents)}
                  {row.lastRetailer ? ` at ${row.lastRetailer}` : ""} · {formatDate(row.lastOn)} ·{" "}
                  {row.sightings === 1 ? "1 sighting" : `${row.sightings} sightings`}
                  {row.confidence === "THIN" ? " (not enough to judge a price yet)" : ""}
                </div>

                {row.spreadCents > 0 && row.confidence !== "THIN" ? (
                  <div className="text-[11px] font-semibold text-oak">
                    Swings {formatCents(row.spreadCents)} between {formatCents(row.lowestCents)} and{" "}
                    {formatCents(row.highestCents)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/shop/deals"
        className="rounded-(--radius-sm) border border-line bg-white px-3.5 py-2.5 text-center text-[11.5px] font-semibold text-ink shadow-(--shadow-card)"
      >
        Check a price against this book →
      </Link>
    </div>
  );
}
