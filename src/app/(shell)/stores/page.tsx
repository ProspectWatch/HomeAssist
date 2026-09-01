import { TopBar } from "@/components/nav/top-bar";
import { HeroImage } from "@/components/ui/hero-image";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { storeBadge, STORES_HERO_IMAGE } from "@/lib/assets";
import { getStoresWithLocations } from "@/lib/data/stores";
import { Store as StoreIcon } from "lucide-react";

export default async function StoresPage() {
  const stores = await getStoresWithLocations();
  const shops = stores.filter((s) => s.kind !== "ONLINE");
  const online = stores.filter((s) => s.kind === "ONLINE");
  const branchCount = shops.reduce((n, s) => n + s.locations.length, 0);

  return (
    <div className="pb-8">
      <TopBar title="Stores" subtitle="Where the prices come from" />
      <div className="mx-5 mb-3.5">
        <HeroImage src={STORES_HERO_IMAGE} alt="Stores" height={160} tabletHeight={240} radiusClassName="rounded-(--radius-lg)" />
      </div>

      {stores.length === 0 ? (
        <div className="px-5">
          <EmptyState icon={StoreIcon} title="No stores loaded" />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 px-5">
          <div className="rounded-(--radius-sm) border border-line bg-white px-3.5 py-2.5 text-[11.5px] text-muted shadow-(--shadow-card)">
            <span className="font-semibold text-ink">{branchCount}</span> branches across{" "}
            <span className="font-semibold text-ink">{shops.length}</span> stores you shop, from OpenStreetMap.
            Flyer deals are matched to these.
          </div>

          {shops.map((store) => {
            const badge = storeBadge(store.name);
            return (
              <div
                key={store.id}
                className="rounded-(--radius-md) border border-line bg-white p-3 shadow-(--shadow-card)"
              >
                <span
                  className="inline-block rounded-[5px] px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: badge.bg, color: badge.color, border: badge.border }}
                >
                  {store.name}
                </span>
                {store.locations.length === 0 ? (
                  <div className="mt-1.5 text-[11.5px] text-muted2">No branch on file yet.</div>
                ) : (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {store.locations.map((location) => (
                      <li key={location.id} className="text-[11.5px] text-muted">
                        {location.address ?? location.name}
                        {location.postalCode ? (
                          <span className="text-muted2"> · {location.postalCode}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {online.length > 0 ? (
            <div className="mt-1 rounded-(--radius-md) border border-line bg-white p-3 shadow-(--shadow-card)">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[12.5px] font-semibold">Online only</span>
                <Badge variant="neutral">no branches</Badge>
              </div>
              <div className="text-[11.5px] text-muted">
                {online.map((s) => s.name).join(" · ")}
              </div>
              <p className="mt-1 text-[11px] text-muted2">
                Website prices are read from these. Nothing here implies you shop at them — they aren&apos;t
                used for flyer deals.
              </p>
            </div>
          ) : null}

          <p className="mt-1 px-1 text-[11px] leading-relaxed text-muted2">
            Distances aren&apos;t shown: working out whether a trip is worth making needs your own location, and
            a guessed distance is worse than none.
          </p>
        </div>
      )}
    </div>
  );
}
