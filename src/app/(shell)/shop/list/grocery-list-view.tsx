"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { ProductPicker } from "@/components/catalog/product-picker";
import { useToast } from "@/components/shell/toast-context";
import { ShopTabs } from "@/components/shell/shop-tabs";
import { CollapsibleSection, useSectionState } from "@/components/ui/collapsible-section";
import { FlavourPicker } from "@/components/shop/flavour-picker";
import { storeBadge } from "@/lib/assets";
import type { GroceryItem } from "@/lib/data/grocery";
import type { CatalogProduct } from "@/lib/data/catalog";
import { CATEGORY_LABEL, CATEGORY_ORDER, mapCatalogCategoryToGroceryCategory } from "@/lib/grocery-categories";
import {
  addGroceryItem,
  clearPurchasedItems,
  setGroceryItemVariants,
  toggleGroceryItem,
} from "./actions";

type ListTab = "all" | "tobuy" | "purchased";

export function GroceryListView({ items }: { items: GroceryItem[] }) {
  const [tab, setTab] = React.useState<ListTab>("all");
  const [flavourFor, setFlavourFor] = React.useState<GroceryItem | null>(null);
  const [, startTransition] = React.useTransition();
  const router = useRouter();
  const showToast = useToast();

  const activeCount = items.filter((i) => !i.checked).length;
  const purchasedCount = items.filter((i) => i.checked).length;

  const visible = items.filter((i) => {
    if (tab === "tobuy") return !i.checked;
    if (tab === "purchased") return i.checked;
    return true;
  });

  const groups = CATEGORY_ORDER.map((cat) => ({
    label: CATEGORY_LABEL[cat],
    items: visible.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  // Aisles fold, but open by default: a shopping list is read while walking a
  // shop, and hiding what you are about to buy behind a tap is the wrong
  // default. Folding is for getting a long list back under control, not for
  // making the common case slower.
  const sections = useSectionState("list-sections", true);

  function submitAddProduct(product: CatalogProduct) {
    startTransition(async () => {
      const res = await addGroceryItem(product.display_name, {
        catalogProductId: product.id,
        category: mapCatalogCategoryToGroceryCategory(product.category),
      });
      if (!res.ok) showToast(res.message);
      else router.refresh();
    });
  }

  function submitAddCustom(name: string) {
    startTransition(async () => {
      const res = await addGroceryItem(name);
      if (!res.ok) showToast(res.message);
      else router.refresh();
    });
  }

  function submitToggle(id: string, checked: boolean) {
    startTransition(async () => {
      const res = await toggleGroceryItem(id, checked);
      if (!res.ok) showToast(res.message);
      else router.refresh();
    });
  }

  function submitVariants(id: string, variants: string[]) {
    startTransition(async () => {
      const res = await setGroceryItemVariants(id, variants);
      if (!res.ok) showToast(res.message);
      else {
        setFlavourFor(null);
        router.refresh();
      }
    });
  }

  function submitClear() {
    startTransition(async () => {
      const res = await clearPurchasedItems();
      if (!res.ok) showToast(res.message);
      else router.refresh();
    });
  }

  return (
    <div className="pb-24">
      <div className="px-5 pt-4 pb-2.5">
        <h1 className="font-serif text-[26px] leading-tight text-ink">Grocery List</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {activeCount} to buy · {purchasedCount} purchased
        </p>
      </div>

      <ShopTabs current="/shop/list" />

      {/* Named, not just implied. A search-shaped box at the top of a list
          reads as "filter this list" unless something says otherwise. */}
      <div className="mb-3 px-5">
        <div className="mb-1 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
          Add an item
        </div>
        <ProductPicker placeholder="What do we need?" onSelect={submitAddProduct} onCustom={submitAddCustom} />
      </div>

      <div className="mb-4 flex items-center justify-between px-5">
        <SegmentedTabs
          options={[
            { key: "all", label: "All" },
            { key: "tobuy", label: "To Buy" },
            { key: "purchased", label: "Purchased" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="Add an item above, or pull items in from Pantry or a Recipe."
        />
      ) : (
        <div className="flex flex-col gap-4.5 px-5">
          {groups.map((group) => (
            <CollapsibleSection
              key={group.label}
              title={group.label}
              count={group.items.length}
              open={sections.isOpen(group.label)}
              onToggle={() => sections.toggle(group.label)}
            >
              <div className="flex flex-col gap-2">
                {group.items.map((item) => {
                  const badge = storeBadge(item.retailer?.name);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2.5 rounded-(--radius-sm) border border-line bg-white p-3 shadow-(--shadow-card)"
                    >
                      <button
                        type="button"
                        onClick={() => submitToggle(item.id, !item.checked)}
                        aria-label={item.checked ? "Mark not purchased" : "Mark purchased"}
                        className="h-[22px] w-[22px] shrink-0 cursor-pointer rounded-full border-[1.6px]"
                        style={{
                          borderColor: item.checked ? "#3F7A55" : "var(--color-line)",
                          background: item.checked ? "#3F7A55" : "transparent",
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-sm"
                          style={{
                            textDecoration: item.checked ? "line-through" : "none",
                            opacity: item.checked ? 0.45 : 1,
                          }}
                        >
                          {item.name}
                        </div>
                        {item.qty ? <div className="text-[11px] text-muted">{item.qty}</div> : null}
                        {item.preferredMatchLabel ? (
                          <div className="mt-0.5 text-[10.5px] text-oak">Preferred: {item.preferredMatchLabel}</div>
                        ) : null}
                        {/* Offered only where this house owns more than one
                            flavour of the brand, or has already picked one. */}
                        {item.flavourOptions.length > 0 || item.variants.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setFlavourFor(item)}
                            className="mt-1 cursor-pointer text-[11px] font-semibold text-oak underline decoration-dotted underline-offset-2"
                          >
                            {item.variants.length > 0
                              ? item.variants.join(", ")
                              : "Choose flavour"}
                          </button>
                        ) : null}
                      </div>
                      {item.has_deal ? (
                        <span className="rounded-[6px] bg-green px-2 py-[3px] text-[10px] font-semibold text-white">
                          Deal
                        </span>
                      ) : null}
                      {item.retailer ? (
                        <span
                          className="rounded-[6px] px-2 py-[3px] text-[10px]"
                          style={{ background: badge.bg, color: badge.color, border: badge.border }}
                        >
                          {item.retailer.name}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          ))}
        </div>
      )}

      <FlavourPicker
        // A fresh sheet per item, seeded from that item's current choice.
        key={flavourFor?.id ?? "none"}
        open={flavourFor !== null}
        itemName={flavourFor?.name ?? ""}
        brand={flavourFor?.flavourBrand ?? null}
        options={flavourFor?.flavourOptions ?? []}
        selected={flavourFor?.variants ?? []}
        onClose={() => setFlavourFor(null)}
        onSave={(variants) => {
          if (flavourFor) submitVariants(flavourFor.id, variants);
        }}
      />

      {purchasedCount > 0 ? (
        <div className="mt-4.5 px-5">
          <Button variant="outline" className="w-full" onClick={submitClear}>
            Clear purchased
          </Button>
        </div>
      ) : null}
    </div>
  );
}
