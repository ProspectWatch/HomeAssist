import { TopBar } from "@/components/nav/top-bar";
import { HeroImage } from "@/components/ui/hero-image";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getPriceHistory } from "@/lib/data/price-history";
import { RECEIPTS_HERO_IMAGE } from "@/lib/assets";
import { formatCents } from "@/lib/money";
import { LineChart } from "lucide-react";

export default async function PriceHistoryPage() {
  const householdId = await getCurrentHouseholdId();
  const history = await getPriceHistory(householdId);

  return (
    <div className="pb-8">
      <TopBar title="Price History" subtitle="Household shopping intelligence" />
      <div className="mx-5 mb-3.5">
        <HeroImage src={RECEIPTS_HERO_IMAGE} alt="Price history" height={150} radiusClassName="rounded-(--radius-lg)" />
      </div>
      {history.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={LineChart}
            title="No price history yet"
            description="Once products are scanned or you log prices manually, trends will show up here."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {history.map((h) => (
            <div key={h.productId} className="flex flex-col gap-1.5 rounded-(--radius-md) border border-line bg-white p-3.5 shadow-(--shadow-card)">
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-semibold">{h.name}</div>
              </div>
              <div className="flex gap-3.5 text-[11.5px] text-muted">
                <span>Last: {formatCents(h.last)}</span>
                <span>Avg: {formatCents(h.avg)}</span>
                <span>Lowest: {formatCents(h.lowest)}</span>
              </div>
              {h.bestStore ? <div className="text-[11px] font-semibold text-oak">Best store: {h.bestStore}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
