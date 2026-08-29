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
import type { PantryProduct } from "@/lib/data/pantry";
import type { CatalogProduct } from "@/lib/data/catalog";
import { addPantryItemToTrip, addPantryRegularBuy } from "./actions";

export function PantryView({ items }: { items: PantryProduct[] }) {
  const [search, setSearch] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const showToast = useToast();

  const filtered = items.filter((i) => i.title.toLowerCase().includes(search.trim().toLowerCase()));

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
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pantry" className="flex-1" />
        <Button size="icon" onClick={() => setAddOpen(true)} aria-label="Add to Pantry">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

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
            title={items.length === 0 ? "No pantry items yet" : "No pantry items match"}
            description={items.length === 0 ? "Tap + above to add a staple you always keep on hand." : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 px-5">
          {filtered.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5 rounded-(--radius-md) border border-line bg-white p-2.5">
              <div className="overflow-hidden rounded-(--radius-sm)">
                <ProductImage src={item.image_url} alt={item.title} height={120} />
              </div>
              <div className="text-[13.5px] leading-tight font-semibold">{item.title}</div>
              {item.package_detail ? <div className="text-[11px] text-muted">{item.package_detail}</div> : null}
              {item.target_price_cents != null ? (
                <div className="text-[11px] font-semibold text-oak">
                  Target: {formatCents(item.target_price_cents)}
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
