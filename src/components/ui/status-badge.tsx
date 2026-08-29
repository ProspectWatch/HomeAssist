import { cn } from "@/lib/utils";

export type PriceStatus = "wait" | "good_price" | "target_hit" | "all_time_low" | "price_dropped";

// Colors are hard-coded per the handoff — independent of the cream/oak/ink
// palette used everywhere else. Do not derive these from theme tokens.
const STATUS_META: Record<PriceStatus, { label: string; bg: string }> = {
  wait: { label: "WAIT", bg: "rgba(29,29,27,.45)" },
  good_price: { label: "GOOD PRICE", bg: "#74876A" },
  target_hit: { label: "TARGET HIT", bg: "#3F7A55" },
  all_time_low: { label: "ALL-TIME LOW", bg: "#B69052" },
  price_dropped: { label: "PRICE DROPPED", bg: "#6E8291" },
};

export function statusMeta(status: PriceStatus) {
  return STATUS_META[status] ?? STATUS_META.wait;
}

export function StatusBadge({ status, className }: { status: PriceStatus; className?: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-[6px] px-2 py-[3px] text-[9.5px] font-bold text-white",
        className,
      )}
      style={{ background: meta.bg }}
    >
      {meta.label}
    </span>
  );
}
