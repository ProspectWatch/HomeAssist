"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ShopTabs } from "@/components/shell/shop-tabs";
import { HeroImage } from "@/components/ui/hero-image";
import { ProductImage } from "@/components/ui/product-image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductPicker } from "@/components/catalog/product-picker";
import { useToast } from "@/components/shell/toast-context";
import { PANTRY_HERO_IMAGE } from "@/lib/assets";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PantryProduct } from "@/lib/data/pantry";
import type { CatalogProduct } from "@/lib/data/catalog";
import { addPantryItemToTrip, addPantryRegularBuy } from "./actions";

const ALL = "All";

export function PantryView({ items }: { items: PantryProduct[] }) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState(ALL);
  const [addOpen, setAddOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const showToast = useToast();

  const categories = React.useMemo(() => {
    const found = new Set<string>();
    for (const item of items) if (item.category) found.add(item.category);
    return [ALL, ...[...found].sort()];
  }, [items]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== ALL && item.category !== category) return false;
      if (!q) return true;
      // Match the household's own rule too, so "marilu" or "tex-mex" finds it.
      return (
        item.title.toLowerCase().includes(q) ||
        (item.preference_hint?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, search, category]);

  function addToTrip(item: PantryProduct) {
    startTransition(async () => {
      const res = await addPantryItemToTrip(item.title, item.package_detail);
      if (!res.ok) showToast(res.message);
      else {
        showToast(`${item.title} added to trip`);
        router.refresh();
      }
    });
  }

  function addRegularBuy(title: string, product?: CatalogProduct) {
    startTransition(async () => {
      const res = await addPantryRegularBuy(title, {
        catalogProductId: product?.id ?? null,
        imageUrl: product?.image_ready ? product.image_url : null,
        packageDetail: product?.default_unit ?? null,
      });
      if (!res.ok) showToast(res.message);
      else {
        setAddOpen(false);
        showToast(`${title} added to Pantry`);
        router.refresh();
      }
    });
  }

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-2.5">
        <h1 className="font-serif text-[26px] leading-tight text-ink">Pantry</h1>
      </div>
      <ShopTabs current="/shop/pantry" />

      <div className="mb-3 flex gap-2 px-5">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search regular buys"
          className="flex-1"
        />
        <Button size="icon" onClick={() => setAddOpen(true)} aria-label="Add to Pantry">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {categories.length > 1 ? (
        <div className="mb-3.5 flex gap-1.5 overflow-x-auto px-5 pb-0.5">
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(name)}
              aria-pressed={category === name}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors",
                category === name
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-muted",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="mb-3 text-sm font-semibold">Add to Pantry</div>
        <ProductPicker
          autoFocus
          placeholder="Search products…"
          onSelect={(product) => addRegularBuy(product.display_name, product)}
          onCustom={(name) => addRegularBuy(name)}
        />
      </BottomSheet>

      <div className="mx-5 mb-3.5">
        <HeroImage
          src={PANTRY_HERO_IMAGE}
          alt="Pantry shelves"
          height={210}
          radiusClassName="rounded-(--radius-xl)"
          overlay="full"
          caption="Regular Buys"
          captionSubtitle="The staples we keep on hand."
        />
      </div>

      {filtered.length === 0 ? (
        <div className="px-5">
          <EmptyState
            title={items.length === 0 ? "No regular buys yet" : "Nothing matches"}
            description={
              items.length === 0
                ? "Tap + above to add a staple you always keep on hand."
                : "Try a different search or category."
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 px-5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-1.5 rounded-(--radius-md) border border-line bg-white p-2.5"
            >
              <div className="overflow-hidden rounded-(--radius-sm)">
                <ProductImage src={item.image_url} alt={item.title} height={120} category={item.category} />
              </div>
              <div className="text-[13.5px] leading-tight font-semibold">{item.title}</div>
              {item.preference_hint ? (
                <div className="text-[11px] leading-tight text-oak">{item.preference_hint}</div>
              ) : null}
              {item.package_detail ? <div className="text-[11px] text-muted">{item.package_detail}</div> : null}
              {item.stock_location ? (
                <div className="text-[11px] text-muted2">Kept in {item.stock_location}</div>
              ) : null}
              {item.target_price_cents != null ? (
                <div className="text-[11px] font-semibold text-oak">
                  Target: {formatCents(item.target_price_cents)}
                </div>
              ) : null}
              {item.stock_status ? (
                <div className="text-[11px] text-muted">
                  {item.stock_status === "low" ? "Running low" : "In stock"}
                </div>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="mt-0.5 bg-cream"
                disabled={pending}
                onClick={() => addToTrip(item)}
              >
                + Trip
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
