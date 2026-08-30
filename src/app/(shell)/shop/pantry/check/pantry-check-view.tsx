"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { StatusActions } from "@/components/pantry/status-actions";
import { FilterChips } from "@/components/shell/filter-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/shell/toast-context";
import { groupByArea } from "@/lib/pantry-areas";
import type { PantryProduct } from "@/lib/data/pantry";
import type { InventoryStatus } from "@/lib/data/inventory";
import { addPantryItemToTrip, setInventoryStatus } from "../actions";

/**
 * Pantry Check — a fast sequential walk through the household's regular buys,
 * grouped by the area you're standing in. One tap per item, no modals, no
 * typing. Items nobody has reviewed stay UNKNOWN rather than being assumed.
 */
export function PantryCheckView({ items }: { items: PantryProduct[] }) {
  const [pending, startTransition] = React.useTransition();
  const [pendingStatus, setPendingStatus] = React.useState<Record<string, InventoryStatus>>({});
  const [hideReviewed, setHideReviewed] = React.useState("Show all");
  const router = useRouter();
  const showToast = useToast();

  const withStatus = React.useMemo(
    () =>
      items.map((item) =>
        pendingStatus[item.id] ? { ...item, inventory_status: pendingStatus[item.id] } : item,
      ),
    [items, pendingStatus],
  );

  const visible = React.useMemo(
    () =>
      hideReviewed === "Still to review"
        ? withStatus.filter((i) => i.inventory_status === "UNKNOWN")
        : withStatus,
    [withStatus, hideReviewed],
  );

  const groups = React.useMemo(() => groupByArea(visible), [visible]);
  const reviewed = withStatus.filter((i) => i.inventory_status !== "UNKNOWN").length;

  function updateStatus(item: PantryProduct, next: InventoryStatus) {
    if (!item.catalog_product_id) return;
    setPendingStatus((prev) => ({ ...prev, [item.id]: next }));
    startTransition(async () => {
      const res = await setInventoryStatus(item.catalog_product_id!, next);
      if (!res.ok) {
        setPendingStatus((prev) => {
          const copy = { ...prev };
          delete copy[item.id];
          return copy;
        });
        showToast(res.message);
      } else {
        router.refresh();
      }
    });
  }

  function addToList(item: PantryProduct) {
    startTransition(async () => {
      const res = await addPantryItemToTrip(item.title, item.package_detail, item.catalog_product_id);
      if (!res.ok) showToast(res.message);
      else {
        showToast(res.alreadyOnList ? `${item.title} is already on the list` : `${item.title} added to list`);
        router.refresh();
      }
    });
  }

  return (
    <div className="pb-10">
      <div className="flex items-center gap-1 px-3 pt-4 pb-1">
        <Link
          href="/shop/pantry"
          aria-label="Back to Pantry"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-serif text-[24px] leading-tight text-ink">Pantry Check</h1>
      </div>
      <p className="px-5 pb-3 text-[12.5px] text-muted">
        {reviewed === 0
          ? "Walk the kitchen and tap what you have. Nothing is assumed until you say so."
          : `${reviewed} of ${items.length} reviewed.`}
      </p>

      <FilterChips
        label="Review filter"
        options={["Show all", "Still to review"]}
        value={hideReviewed}
        onChange={setHideReviewed}
      />

      {groups.length === 0 ? (
        <div className="px-5">
          <EmptyState
            title={items.length === 0 ? "No regular buys yet" : "All reviewed"}
            description={
              items.length === 0
                ? "Add staples in Pantry first, then run a check."
                : "Every regular buy has a status. Switch to Show all to change one."
            }
          />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.area} className="mb-5">
            <div className="sticky top-0 z-10 bg-[#faf8f4]/95 px-5 py-2 backdrop-blur">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
                  {group.area}
                </h2>
                <span className="text-[11px] text-muted2">{group.items.length}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 px-5">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-(--radius-md) border border-line bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 shrink-0 overflow-hidden rounded-(--radius-sm)">
                      <ProductImage src={item.image_url} alt={item.title} height={48} category={item.category} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] leading-tight font-semibold">{item.title}</div>
                      {item.preference_hint ? (
                        <div className="truncate text-[11.5px] leading-tight text-oak">
                          {item.preference_hint}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <StatusActions
                    status={item.inventory_status}
                    onList={item.on_list}
                    disabled={pending}
                    onSetStatus={(next) => updateStatus(item, next)}
                    onAddToList={() => addToList(item)}
                  />
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
