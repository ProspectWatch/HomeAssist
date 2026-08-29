"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { useToast } from "@/components/shell/toast-context";
import { ShopTabs } from "@/components/shell/shop-tabs";
import { storeBadge } from "@/lib/assets";
import type { GroceryItem } from "@/lib/data/grocery";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/grocery-categories";
import { addGroceryItem, clearPurchasedItems, toggleGroceryItem } from "./actions";

type ListTab = "all" | "tobuy" | "purchased";

export function GroceryListView({ items }: { items: GroceryItem[] }) {
  const [tab, setTab] = React.useState<ListTab>("all");
  const [newItem, setNewItem] = React.useState("");
  const [pending, startTransition] = React.useTransition();
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

  function submitAdd() {
    const text = newItem.trim();
    if (!text) return;
    setNewItem("");
    startTransition(async () => {
      const res = await addGroceryItem(text);
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

      <div className="mb-3 flex gap-2 px-5">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitAdd()}
          placeholder="What do we need?"
          className="flex-1"
        />
        <Button onClick={submitAdd} disabled={pending}>
          Add
        </Button>
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
            <div key={group.label}>
              <div className="mb-2 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
                {group.label}
              </div>
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
            </div>
          ))}
        </div>
      )}

      {purchasedCount > 0 ? (
        <div className="mt-4.5 px-5">
          <Button variant="outline" className="w-full" onClick={submitClear}>
            Clear purchased
          </Button>
        </div>
      ) : null}

      <div className="fixed right-4 left-4 z-[120] mx-auto max-w-md" style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 0.75rem)" }}>
        <Button size="lg" className="w-full shadow-[0_12px_28px_rgba(29,29,27,.25)]" onClick={submitAdd}>
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      </div>
    </div>
  );
}
