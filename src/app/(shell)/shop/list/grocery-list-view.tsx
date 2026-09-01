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
import { StoreTagSheet, type StoreOption } from "@/components/shop/store-tag";
import { isStale, verdictFor, type ListItemCheck } from "@/lib/shopping/list-check";
import { storeBadge } from "@/lib/assets";
import type { GroceryItem } from "@/lib/data/grocery";
import type { CatalogProduct } from "@/lib/data/catalog";
import { CATEGORY_LABEL, CATEGORY_ORDER, mapCatalogCategoryToGroceryCategory } from "@/lib/grocery-categories";
import {
  addGroceryItem,
  checkListAgainstStores,
  clearPurchasedItems,
  setGroceryItemStore,
  setGroceryItemVariants,
  toggleGroceryItem,
} from "./actions";

type ListTab = "all" | "tobuy" | "purchased";

export function GroceryListView({ items, stores }: { items: GroceryItem[]; stores: StoreOption[] }) {
  const [tab, setTab] = React.useState<ListTab>("all");
  const [flavourFor, setFlavourFor] = React.useState<GroceryItem | null>(null);
  const [storeFor, setStoreFor] = React.useState<GroceryItem | null>(null);
  const [checks, setChecks] = React.useState<{ checks: ListItemCheck[]; today: string } | null>(null);
  const [checking, startCheck] = React.useTransition();
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

  function submitStore(item: GroceryItem, retailerId: string | null, strength: "ALWAYS" | "SOMETIMES" | null) {
    startTransition(async () => {
      const res = await setGroceryItemStore(item.id, retailerId, strength);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      setStoreFor(null);
      // Says which of the two things happened, because they are different
      // promises: one lasts a trip, the other lasts until they change it.
      showToast(
        retailerId === null
          ? "Store cleared"
          : res.remembered
            ? `Remembered — ${item.name} will come back tagged`
            : `Tagged for this trip`,
      );
      router.refresh();
    });
  }

  function runCheck() {
    startCheck(async () => {
      const res = await checkListAgainstStores();
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      setChecks({ checks: res.checks, today: res.today });
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

      <div className="mb-3 px-5">
        <Button variant="outline" className="w-full" disabled={checking} onClick={runCheck}>
          {checking ? "Checking your stores…" : "Check prices across your stores"}
        </Button>
      </div>

      {checks ? <ListCheckPanel result={checks} onClose={() => setChecks(null)} /> : null}

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
                      {/* The badge is the control: tap it to say where this
                          gets bought, or to change it. */}
                      <button
                        type="button"
                        onClick={() => setStoreFor(item)}
                        aria-label={
                          item.retailer ? `Change store for ${item.name}` : `Set store for ${item.name}`
                        }
                        className="shrink-0 cursor-pointer rounded-[6px] px-2 py-[3px] text-[10px]"
                        style={
                          item.retailer
                            ? { background: badge.bg, color: badge.color, border: badge.border }
                            : {
                                background: "transparent",
                                color: "var(--color-muted2)",
                                border: "1px dashed var(--color-line)",
                              }
                        }
                      >
                        {item.retailer ? item.retailer.name : "Store"}
                      </button>
                    </div>
                  );
                })}
            </CollapsibleSection>
          ))}
        </div>
      )}

      <StoreTagSheet
        key={storeFor?.id ?? "store-closed"}
        open={storeFor !== null}
        itemName={storeFor?.name ?? ""}
        stores={stores}
        currentRetailerId={storeFor?.retailerId ?? null}
        onClose={() => setStoreFor(null)}
        onPick={(retailerId, strength) => {
          if (storeFor) submitStore(storeFor, retailerId, strength);
        }}
      />

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

/**
 * What the check found.
 *
 * Deliberately says how old each price is. A fortnight-old flyer price shown
 * without its date is a price you would drive across town for and then not
 * find, so anything past two weeks is marked rather than quietly presented as
 * current.
 */
function ListCheckPanel({
  result,
  onClose,
}: {
  result: { checks: ListItemCheck[]; today: string };
  onClose: () => void;
}) {
  const savings = result.checks
    .map(verdictFor)
    .filter((v) => v.kind === "cheaper-elsewhere")
    .reduce((sum, v) => sum + (v.kind === "cheaper-elsewhere" ? v.savingCents : 0), 0);
  const unknown = result.checks.filter((c) => c.sightings.length === 0).length;

  return (
    <div className="mx-5 mb-4 rounded-(--radius-md) border border-line bg-white p-3.5 shadow-(--shadow-card)">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
          Across your stores
        </div>
        <button type="button" onClick={onClose} className="cursor-pointer text-[12px] font-semibold text-muted2">
          Close
        </button>
      </div>

      <p className="mb-2.5 text-[12px] leading-snug text-muted">
        From prices already collected — not a live stock check.{" "}
        {savings > 0 ? `Up to $${(savings / 100).toFixed(2)} cheaper elsewhere. ` : ""}
        {unknown > 0 ? `${unknown} item${unknown === 1 ? "" : "s"} never priced anywhere.` : ""}
      </p>

      <div className="flex flex-col gap-1.5">
        {result.checks.map((check) => {
          const verdict = verdictFor(check);
          const stale = check.cheapest ? isStale(check.cheapest.seenOn, result.today) : false;
          return (
            <div key={check.itemId} className="text-[12.5px]">
              <span className="font-semibold text-ink">{check.name}</span>
              <span
                className={
                  verdict.kind === "cheaper-elsewhere"
                    ? "text-green"
                    : verdict.kind === "none"
                      ? "text-muted2"
                      : "text-muted"
                }
              >
                {" — "}
                {verdict.text}
              </span>
              {stale ? <span className="text-muted2"> · over 2 weeks old</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
