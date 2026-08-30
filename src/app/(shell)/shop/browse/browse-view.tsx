"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ShopTabs } from "@/components/shell/shop-tabs";
import { ProductImage } from "@/components/ui/product-image";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/shell/toast-context";
import { useCatalog } from "@/lib/use-catalog";
import { mapCatalogCategoryToGroceryCategory } from "@/lib/grocery-categories";
import type { CatalogCategory, CatalogProduct } from "@/lib/data/catalog";
import { addGroceryItem } from "@/app/(shell)/shop/list/actions";

// Category -> Subcategory -> Product drill-down (step 5). Categories and
// counts come from the server (product_categories/product_subcategories);
// the product list at the leaf level filters the same client-cached
// catalogue the ProductPicker uses, so no extra round-trip per tap.
export function BrowseView({ categories }: { categories: CatalogCategory[] }) {
  const [category, setCategory] = React.useState<string | null>(null);
  const [subcategory, setSubcategory] = React.useState<string | null>(null);
  const { products } = useCatalog();
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const showToast = useToast();

  const activeCategory = categories.find((c) => c.name === category) ?? null;

  const subcategoryProducts = React.useMemo(() => {
    if (!category || !subcategory) return [];
    return products.filter((p) => p.category === category && p.subcategory === subcategory);
  }, [products, category, subcategory]);

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

  const title = subcategory ?? category ?? "Browse";

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-2.5">
        <h1 className="font-serif text-[26px] leading-tight text-ink">{title}</h1>
      </div>

      <ShopTabs current="/shop/browse" />

      {(category || subcategory) && (
        <button
          type="button"
          onClick={() => (subcategory ? setSubcategory(null) : setCategory(null))}
          className="mb-3 flex cursor-pointer items-center gap-1 px-5 text-[12.5px] font-medium text-oak"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}

      {!category ? (
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
        <div className="grid grid-cols-2 gap-2.5 px-5">
          {subcategoryProducts.map((product) => (
            <div key={product.id} className="flex flex-col gap-1.5 rounded-(--radius-md) border border-line bg-white p-2.5">
              <div className="overflow-hidden rounded-(--radius-sm)">
                <ProductImage
                  src={product.image_ready ? product.image_url : null}
                  alt={product.display_name}
                  height={100}
                />
              </div>
              <div className="text-[13px] leading-tight font-semibold">{product.display_name}</div>
              {product.brand ? <div className="text-[11px] text-muted">{product.brand}</div> : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => addToList(product)}
                className="mt-0.5 flex cursor-pointer items-center justify-center gap-1 rounded-(--radius-sm) border border-line bg-cream py-1.5 text-[11.5px] font-semibold text-ink"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
