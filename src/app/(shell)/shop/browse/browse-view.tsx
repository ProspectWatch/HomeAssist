"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Star } from "lucide-react";
import { ShopTabs } from "@/components/shell/shop-tabs";
import { ProductImage } from "@/components/ui/product-image";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/shell/toast-context";
import { useCatalog } from "@/lib/use-catalog";
import { mapCatalogCategoryToGroceryCategory } from "@/lib/grocery-categories";
import { cn } from "@/lib/utils";
import type { CatalogCategory, CatalogProduct } from "@/lib/data/catalog";
import { searchCatalog } from "@/lib/catalog-search";
import { setRegularBuy } from "@/app/(shell)/shop/regular-buys/actions";
import { addGroceryItem } from "@/app/(shell)/shop/list/actions";

// Category -> Subcategory -> Product drill-down (step 5). Categories and
// counts come from the server (product_categories/product_subcategories);
// the product list at the leaf level filters the same client-cached
// catalogue the ProductPicker uses, so no extra round-trip per tap.
export function BrowseView({
  categories,
  regularBuyIds,
}: {
  categories: CatalogCategory[];
  regularBuyIds: string[];
}) {
  const [category, setCategory] = React.useState<string | null>(null);
  const [subcategory, setSubcategory] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  // Optimistic overrides layered over what the server sent, so the star
  // responds on the tap rather than after the round trip — tagging a baseline
  // means doing this dozens of times in a row. Derived rather than copied into
  // state, so a refreshed prop never fights a local copy.
  const [overrides, setOverrides] = React.useState<ReadonlyMap<string, boolean>>(new Map());
  const serverTagged = React.useMemo(() => new Set(regularBuyIds), [regularBuyIds]);
  const isTagged = React.useCallback(
    (id: string) => overrides.get(id) ?? serverTagged.has(id),
    [overrides, serverTagged],
  );
  const { products } = useCatalog();
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const showToast = useToast();

  const activeCategory = categories.find((c) => c.name === category) ?? null;

  const subcategoryProducts = React.useMemo(() => {
    if (!category || !subcategory) return [];
    return products.filter((p) => p.category === category && p.subcategory === subcategory);
  }, [products, category, subcategory]);

  // A search cuts across the whole catalogue: with 1,600+ products, drilling
  // by taps alone is the slow way to find one thing.
  const searchResults = React.useMemo(
    () => (query.trim() ? searchCatalog(products, query, 60) : []),
    [products, query],
  );
  const searching = query.trim().length > 0;

  function toggleRegular(product: CatalogProduct) {
    const on = !isTagged(product.id);
    const override = (value: boolean | undefined) =>
      setOverrides((prev) => {
        const next = new Map(prev);
        if (value === undefined) next.delete(product.id);
        else next.set(product.id, value);
        return next;
      });

    override(on);
    startTransition(async () => {
      const res = await setRegularBuy(product.id, product.display_name, on);
      if (!res.ok) {
        // Drop the override; the write didn't happen, so the server's answer
        // is the truth again.
        override(undefined);
        showToast(res.message);
        return;
      }
      showToast(on ? `${product.display_name} is a regular buy` : `${product.display_name} removed`);
      router.refresh();
    });
  }

  function addToList(product: CatalogProduct) {
    startTransition(async () => {
      const res = await addGroceryItem(product.display_name, {
        catalogProductId: product.id,
        category: mapCatalogCategoryToGroceryCategory(product.category),
      });
      if (!res.ok) showToast(res.message);
      else {
        showToast(`${product.display_name} added to list`);
        router.refresh();
      }
    });
  }

  const title = searching ? "Search" : (subcategory ?? category ?? "Browse");

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-2.5">
        <h1 className="font-serif text-[26px] leading-tight text-ink">{title}</h1>
      </div>

      <ShopTabs current="/shop/browse" />

      <div className="px-5 pb-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all products"
        />
      </div>

      {!searching && (category || subcategory) && (
        <button
          type="button"
          onClick={() => (subcategory ? setSubcategory(null) : setCategory(null))}
          className="mb-3 flex cursor-pointer items-center gap-1 px-5 text-[12.5px] font-medium text-oak"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}

      {searching ? (
        searchResults.length === 0 ? (
          <div className="px-5">
            <EmptyState title="No matches" description="Nothing in the catalogue matches that." />
          </div>
        ) : (
          <ProductGrid
            products={searchResults}
            isTagged={isTagged}
            pending={pending}
            onAdd={addToList}
            onToggleRegular={toggleRegular}
          />
        )
      ) : !category ? (
        <div className="flex flex-col gap-2 px-5">
          {categories.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setCategory(cat.name)}
              className="flex cursor-pointer items-center justify-between rounded-(--radius-sm) border border-line bg-white p-3.5 text-left shadow-(--shadow-card)"
            >
              <span className="text-[14px] font-semibold text-ink">{cat.name}</span>
              <ChevronRight className="h-4 w-4 text-muted2" />
            </button>
          ))}
        </div>
      ) : !subcategory ? (
        <div className="flex flex-col gap-2 px-5">
          {(activeCategory?.subcategories ?? []).map((sub) => (
            <button
              key={sub.name}
              type="button"
              onClick={() => setSubcategory(sub.name)}
              className="flex cursor-pointer items-center justify-between rounded-(--radius-sm) border border-line bg-white p-3.5 text-left shadow-(--shadow-card)"
            >
              <span className="text-[14px] font-semibold text-ink">{sub.name}</span>
              <span className="flex items-center gap-2 text-[11px] text-muted">
                {sub.product_count} {sub.product_count === 1 ? "item" : "items"}
                <ChevronRight className="h-4 w-4 text-muted2" />
              </span>
            </button>
          ))}
        </div>
      ) : subcategoryProducts.length === 0 ? (
        <div className="px-5">
          <EmptyState title="No products yet" description="Nothing in this subcategory yet." />
        </div>
      ) : (
        <ProductGrid
          products={subcategoryProducts}
          isTagged={isTagged}
          pending={pending}
          onAdd={addToList}
          onToggleRegular={toggleRegular}
        />
      )}
    </div>
  );
}

/**
 * The product tile. The star is the point of this screen: tagging what the
 * household actually buys is what gives deal matching something to match.
 */
function ProductGrid({
  products,
  isTagged,
  pending,
  onAdd,
  onToggleRegular,
}: {
  products: CatalogProduct[];
  isTagged: (id: string) => boolean;
  pending: boolean;
  onAdd: (product: CatalogProduct) => void;
  onToggleRegular: (product: CatalogProduct) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 px-5">
      {products.map((product) => {
        const isRegular = isTagged(product.id);
        return (
          <div
            key={product.id}
            className="relative flex flex-col gap-1.5 rounded-(--radius-md) border border-line bg-white p-2.5"
          >
            <button
              type="button"
              aria-pressed={isRegular}
              aria-label={
                isRegular
                  ? `Remove ${product.display_name} from regular buys`
                  : `Mark ${product.display_name} as a regular buy`
              }
              onClick={() => onToggleRegular(product)}
              className="absolute top-1.5 right-1.5 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/90"
            >
              <Star
                className={cn(
                  "h-4.5 w-4.5",
                  isRegular ? "fill-oak text-oak" : "text-muted2",
                )}
              />
            </button>

            <div className="overflow-hidden rounded-(--radius-sm)">
              <ProductImage
                src={product.image_ready ? product.image_url : null}
                alt={product.display_name}
                height={100}
                category={product.category}
              />
            </div>
            <div className="text-[13px] leading-tight font-semibold">{product.display_name}</div>
            {product.brand ? <div className="text-[11px] text-muted">{product.brand}</div> : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => onAdd(product)}
              className="mt-0.5 flex cursor-pointer items-center justify-center gap-1 rounded-(--radius-sm) border border-line bg-cream py-1.5 text-[11.5px] font-semibold text-ink"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        );
      })}
    </div>
  );
}
