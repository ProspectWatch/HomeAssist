import { TrendingDown, TrendingUp } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { ReceiptPriceNote } from "@/lib/data/receipt-prices";

/**
 * How this shop compared to what the household normally pays. Silent when
 * there isn't enough history to say anything true — an empty section is the
 * correct output for a first receipt, not a failure.
 */
export function PriceNotes({ notes }: { notes: ReceiptPriceNote[] }) {
  if (notes.length === 0) return null;

  return (
    <section className="mb-4 px-5">
      <div className="pb-2 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        Price check
      </div>
      <div className="flex flex-col gap-2">
        {notes.map((note) => {
          const high = note.verdict.code === "HIGH";
          const Icon = high ? TrendingUp : TrendingDown;
          return (
            <div
              key={note.lineId}
              className={`rounded-(--radius-sm) border p-3 ${
                high ? "border-oak bg-oak/15" : "border-green bg-green/10"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate text-[12.5px] font-semibold">{note.name}</span>
                </div>
                <span className="shrink-0 text-[12.5px] font-semibold">{formatCents(note.priceCents)}</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{note.verdict.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
