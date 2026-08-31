"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { FilterChips } from "@/components/shell/filter-chips";
import { StatusActions } from "@/components/pantry/status-actions";
import { PANTRY_HERO_IMAGE } from "@/lib/assets";
import type { PantryProduct } from "@/lib/data/pantry";
import type { InventoryStatus } from "@/lib/data/inventory";
import type { CatalogProduct } from "@/lib/data/catalog";
import {
  addPantryItemToTrip,
  addPantryRegularBuy,
  preparePantryImageUpload,
  setFavourite,
  setInventoryStatus,
  setPantryImage,
} from "./actions";
import { ProductPhotoButton } from "@/components/pantry/product-photo-button";
import { CollapsibleSection, useSectionState } from "@/components/ui/collapsible-section";
import { FavouriteButton } from "@/components/ui/favourite-button";

const ALL = "All";
const STATUS_FILTERS = ["All", "In Stock", "Low", "Out", "Unknown", "On List"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function matchesStatus(item: PantryProduct, filter: StatusFilter): boolean {
  switch (filter) {
    case "All":
      return true;
    case "In Stock":
      return item.inventory_status === "IN_STOCK";
    case "Low":
      return item.inventory_status === "LOW";
    case "Out":
      return item.inventory_status === "OUT";
    case "Unknown":
      return item.inventory_status === "UNKNOWN";
    case "On List":
      return item.on_list;
  }
}

export function PantryView({ items }: { items: PantryProduct[] }) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState(ALL);
  const [location, setLocation] = React.useState(ALL);
  const [status, setStatus] = React.useState<StatusFilter>("All");
  const [addOpen, setAddOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  // Optimistic status so a tap feels instant while the write is in flight.
  const [pendingStatus, setPendingStatus] = React.useState<Record<string, InventoryStatus>>({});
  const router = useRouter();
  const showToast = useToast();

  const withStatus = React.useMemo(
    () =>
      items.map((item) =>
        pendingStatus[item.id] ? { ...item, inventory_status: pendingStatus[item.id] } : item,
      ),
    [items, pendingStatus],
  );

  const categories = React.useMemo(() => {
    const found = new Set<string>();
    for (const item of items) if (item.category) found.add(item.category);
    return [ALL, ...[...found].sort()];
  }, [items]);

  const locations = React.useMemo(() => {
    const found = new Set<string>();
    for (const item of items) if (item.stock_location) found.add(item.stock_location);
    return found.size > 0 ? [ALL, ...[...found].sort()] : [];
  }, [items]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return withStatus.filter((item) => {
      if (category !== ALL && item.category !== category) return false;
      if (location !== ALL && item.stock_location !== location) return false;
      if (!matchesStatus(item, status)) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.preference_hint?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [withStatus, search, category, location, status]);

  /**
   * 213 regular buys is too many to scroll. Grouping by category and folding
   * each group turns the screen into an index you can see all of at once.
   * Favourites are lifted out into their own group at the top, open by
   * default, because that is the short list you came for.
   */
  const groups = React.useMemo(() => {
    const favourites = filtered.filter((i) => i.is_favourite);
    const byCategory = new Map<string, PantryProduct[]>();
    for (const item of filtered) {
      if (item.is_favourite) continue;
      const key = item.category ?? "Other";
      const bucket = byCategory.get(key);
      if (bucket) bucket.push(item);
      else byCategory.set(key, [item]);
    }
    const rest = [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, list]) => ({ id: title, title, items: list, openByDefault: false }));
    return favourites.length > 0
      ? [{ id: "__favourites", title: "Favourites", items: favourites, openByDefault: true }, ...rest]
      : rest;
  }, [filtered]);

  // Searching is a different intent from browsing: you already know what you
  // want, so every group opens rather than making you fold your way to it.
  const searching = search.trim().length > 0;
  const sections = useSectionState("pantry-sections", false);

  const reviewed = withStatus.filter((i) => i.inventory_status !== "UNKNOWN").length;

  function toggleFavourite(item: PantryProduct, next: boolean) {
    return setFavourite({
      catalogProductId: item.id.startsWith("pref:") ? item.catalog_product_id : null,
      productId: item.id.startsWith("pref:") ? null : item.id,
      title: item.title,
      favourite: next,
    }).then((res) => {
      if (!res.ok) showToast(res.message);
      else router.refresh();
      return { ok: res.ok };
    });
  }

  function updateStatus(item: PantryProduct, next: InventoryStatus) {
    if (!item.catalog_product_id) {
      showToast("Add this from the product catalogue to track its status.");
      return;
    }
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

      <div className="mb-3 px-5">
        <Link
          href="/shop/pantry/check"
          className="flex items-center justify-between rounded-(--radius-md) border border-line bg-white px-4 py-3"
        >
          <div>
            <div className="text-[14px] font-semibold text-ink">Pantry Check</div>
            <div className="text-[11.5px] text-muted">
              {reviewed === 0
                ? "Start a Pantry Check to update what you have."
                : `${reviewed} of ${items.length} reviewed — pick up where you left off.`}
            </div>
          </div>
          <span aria-hidden="true" className="text-[18px] text-muted2">
            ›
          </span>
        </Link>
      </div>

      <FilterChips label="Status" options={[...STATUS_FILTERS]} value={status} onChange={(v) => setStatus(v as StatusFilter)} />
      {categories.length > 1 ? (
        <FilterChips label="Category" options={categories} value={category} onChange={setCategory} />
      ) : null}
      {locations.length > 1 ? (
        <FilterChips label="Location" options={locations} value={location} onChange={setLocation} />
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

      <div className="mx-5 mt-1 mb-3.5">
        <HeroImage
          src={PANTRY_HERO_IMAGE}
          alt="Pantry shelves"
          height={180}
          radiusClassName="rounded-(--radius-xl)"
          overlay="full"
          caption="Regular Buys"
          captionSubtitle={`${items.length} staples we keep on hand.`}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="px-5">
          <EmptyState
            title={items.length === 0 ? "No regular buys yet" : "Nothing matches"}
            description={
              items.length === 0
                ? "Tap + above to add a staple you always keep on hand."
                : "Try a different search, status or category."
            }
          />
        </div>
      ) : (
        groups.map((group) => (
          <CollapsibleSection
            key={group.id}
            title={group.title}
            count={group.items.length}
            open={searching || sections.isOpen(group.id) || group.openByDefault}
            onToggle={() => sections.toggle(group.id)}
          >
            {group.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-(--radius-md) border border-line bg-white p-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-14 shrink-0 overflow-hidden rounded-(--radius-sm)">
                  <ProductImage src={item.image_url} alt={item.title} height={56} category={item.category} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] leading-tight font-semibold">{item.title}</div>
                  {item.preference_hint ? (
                    <div className="truncate text-[11.5px] leading-tight text-oak">{item.preference_hint}</div>
                  ) : null}
                  {item.stock_location ? (
                    <div className="text-[11px] text-muted2">{item.stock_location}</div>
                  ) : null}
                </div>
                <FavouriteButton
                  title={item.title}
                  isFavourite={item.is_favourite}
                  onToggle={(next) => toggleFavourite(item, next)}
                />
                <ProductPhotoButton
                  title={item.title}
                  // A row backed by a preference writes to the household layer;
                  // a household-owned SKU writes to its own row. Each keeps its
                  // photo where the rest of its data already lives.
                  catalogProductId={item.id.startsWith("pref:") ? item.catalog_product_id : null}
                  productId={item.id.startsWith("pref:") ? null : item.id}
                  hasPhoto={Boolean(item.image_url)}
                  prepare={preparePantryImageUpload}
                  attach={setPantryImage}
                  onUploaded={() => router.refresh()}
                  onError={showToast}
                />
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
          </CollapsibleSection>
        ))
      )}
    </div>
  );
}
