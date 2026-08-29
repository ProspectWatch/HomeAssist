import { TopBar } from "@/components/nav/top-bar";
import { HeroImage } from "@/components/ui/hero-image";
import { EmptyState } from "@/components/ui/empty-state";
import { storeBadge, STORES_HERO_IMAGE } from "@/lib/assets";
import { getStores } from "@/lib/data/stores";
import { Store as StoreIcon } from "lucide-react";

export default async function StoresPage() {
  const stores = await getStores();

  return (
    <div className="pb-8">
      <TopBar title="Stores" subtitle="Retailers HomeAssist knows about." />
      <div className="mx-5 mb-3.5">
        <HeroImage src={STORES_HERO_IMAGE} alt="Stores" height={160} radiusClassName="rounded-(--radius-lg)" />
      </div>
      {stores.length === 0 ? (
        <div className="px-5">
          <EmptyState icon={StoreIcon} title="No stores loaded" />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 px-5">
          {stores.map((store) => {
            const badge = storeBadge(store.name);
            return (
              <div key={store.id} className="flex items-center gap-3 rounded-(--radius-md) border border-line bg-white p-2.5 shadow-(--shadow-card)">
                <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-(--radius-sm) bg-cream text-[10px] text-muted2">
                  {store.domain}
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className="inline-block rounded-[5px] px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: badge.bg, color: badge.color, border: badge.border }}
                  >
                    {store.name}
                  </span>
                  <div className="mt-1 text-xs text-muted">Distance not available yet — add your address in Search Settings.</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
