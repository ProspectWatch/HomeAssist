"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Star, X } from "lucide-react";
import { ShopTabs } from "@/components/shell/shop-tabs";
import { ProductImage } from "@/components/ui/product-image";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/shell/toast-context";
import {
  BRAND_RIGIDITY_OPTIONS,
  describeBrandPreference,
  groupRegularBuys,
  type BrandRigidity,
  type RegularBuy,
} from "@/lib/household/regular-buys";
import { setBrandPreference, setRegularBuy } from "./actions";

/**
 * The household's baseline: everything it actually buys, in one place.
 *
 * Brand lives here rather than on the catalogue product, because the
 * catalogue is deliberately generic — "Potato Chips" is what a flyer or a
 * receipt matches, and this says whether the brand on offer is one the
 * household will take.
 */
export function RegularBuysView({ buys }: { buys: RegularBuy[] }) {
  const [filter, setFilter] = React.useState("");
  const [editing, setEditing] = React.useState<RegularBuy | null>(null);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const showToast = useToast();

  const query = filter.trim().toLowerCase();
  const visible = query
    ? buys.filter(
        (b) =>
          b.displayName.toLowerCase().includes(query) ||
          b.category.toLowerCase().includes(query) ||
          (b.preferredBrand ?? "").toLowerCase().includes(query),
      )
    : buys;
  const groups = groupRegularBuys(visible);

  function untag(buy: RegularBuy) {
    startTransition(async () => {
      const res = await setRegularBuy(buy.catalogProductId, buy.displayName, false);
      if (!res.ok) showToast(res.message);
      else {
        showToast(`${buy.displayName} removed from regular buys`);
        router.refresh();
      }
    });
  }

  function saveBrand(buy: RegularBuy, brand: string, rigidity: BrandRigidity) {
    startTransition(async () => {
      const res = await setBrandPreference(buy.catalogProductId, {
        preferredBrand: brand,
        brandRigidity: rigidity,
      });
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      setEditing(null);
      showToast("Brand preference saved");
      router.refresh();
    });
  }

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-2.5">
        <h1 className="font-serif text-[26px] leading-tight text-ink">Regular buys</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {buys.length} {buys.length === 1 ? "product" : "products"} — the baseline deals are matched against.
        </p>
      </div>

      <ShopTabs current="/shop/regular-buys" />

      {buys.length === 0 ? (
        <div className="px-5">
          <EmptyState
            title="Nothing tagged yet"
            description="Browse the catalogue and tap the star on anything you buy regularly."
          />
        </div>
      ) : (
        <>
          <div className="px-5 pb-3">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter your regular buys"
            />
          </div>

          {groups.length === 0 ? (
            <div className="px-5">
              <EmptyState title="No matches" description="Nothing here matches that." />
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.category} className="mb-4">
                <div className="px-5 pb-2 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
                  {group.category} ({group.items.length})
                </div>
                <div className="flex flex-col gap-2 px-5">
                  {group.items.map((buy) => {
                    const brandLine = describeBrandPreference(buy);
                    return (
                      <div
                        key={buy.catalogProductId}
                        className="flex items-center gap-3 rounded-(--radius-md) border border-line bg-white p-2.5"
                      >
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-(--radius-sm) border border-line">
                          <ProductImage
                            src={buy.imageReady ? buy.imageUrl : null}
                            alt={buy.displayName}
                            height={44}
                            category={buy.category}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditing(buy)}
                          className="min-w-0 flex-1 cursor-pointer text-left"
                        >
                          <div className="truncate text-[14px] font-semibold text-ink">{buy.displayName}</div>
                          <div className="truncate text-[11.5px] text-muted">
                            {brandLine ?? "Any brand"}
                            {buy.subcategory ? ` · ${buy.subcategory}` : ""}
                          </div>
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${buy.displayName} from regular buys`}
                          disabled={pending}
                          onClick={() => untag(buy)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted2 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </>
      )}

      <BottomSheet open={editing !== null} onClose={() => setEditing(null)}>
        {editing ? <BrandForm buy={editing} pending={pending} onSave={saveBrand} /> : null}
      </BottomSheet>
    </div>
  );
}

function BrandForm({
  buy,
  pending,
  onSave,
}: {
  buy: RegularBuy;
  pending: boolean;
  onSave: (buy: RegularBuy, brand: string, rigidity: BrandRigidity) => void;
}) {
  const [brand, setBrand] = React.useState(buy.preferredBrand ?? "");
  const [rigidity, setRigidity] = React.useState<BrandRigidity>(buy.brandRigidity);

  return (
    <div>
      <div className="mb-1 text-sm font-semibold">{buy.displayName}</div>
      <p className="mb-3 text-[12px] text-muted">
        The catalogue keeps this generic so any brand of it can match a deal. Say which brand you
        actually want and how strictly.
      </p>

      <label htmlFor="brand" className="mb-1 block text-[12px] font-semibold text-ink">
        Brand <span className="font-normal text-muted2">(optional)</span>
      </label>
      <Input
        id="brand"
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        placeholder="e.g. Lay's"
        className="mb-3"
      />

      <div className="mb-1 text-[12px] font-semibold text-ink">How strict?</div>
      <div className="mb-4 flex flex-col gap-1.5">
        {BRAND_RIGIDITY_OPTIONS.map((option) => {
          const active = option.value === rigidity;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setRigidity(option.value)}
              className={
                active
                  ? "flex items-start gap-2 rounded-(--radius-sm) border border-ink bg-cream p-2.5 text-left"
                  : "flex items-start gap-2 rounded-(--radius-sm) border border-line bg-white p-2.5 text-left"
              }
            >
              <Check className={active ? "mt-0.5 h-4 w-4 text-ink" : "mt-0.5 h-4 w-4 text-transparent"} />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ink">{option.label}</span>
                <span className="block text-[11.5px] text-muted">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() => onSave(buy, brand, rigidity)}
      >
        <Star className="mr-1.5 h-4 w-4" /> Save preference
      </Button>
    </div>
  );
}
