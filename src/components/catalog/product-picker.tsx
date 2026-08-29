"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/ui/product-image";
import { useCatalog } from "@/lib/use-catalog";
import { searchCatalog } from "@/lib/catalog-search";
import type { CatalogProduct } from "@/lib/data/catalog";

/**
 * Reusable typeahead over the product catalogue (step 4). Renders an input
 * plus a dropdown of matches as the user types; always offers "Add <query>
 * as a custom item" so the catalogue is never a forced match. Used from
 * Grocery List, Pantry, Watch, Recipes, and the global Add sheet.
 */
export function ProductPicker({
  onSelect,
  onCustom,
  placeholder = "Search products…",
  autoFocus,
  className,
}: {
  onSelect: (product: CatalogProduct) => void;
  onCustom: (name: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const { products } = useCatalog();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const matches = React.useMemo(() => searchCatalog(products, query, 8), [products, query]);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectProduct(product: CatalogProduct) {
    onSelect(product);
    setQuery("");
    setOpen(false);
  }

  function selectCustom() {
    const trimmed = query.trim();
    if (!trimmed) return;
    onCustom(trimmed);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (matches[0]) selectProduct(matches[0]);
            else selectCustom();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />

      {open && query.trim() ? (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-[200] max-h-[320px] overflow-y-auto rounded-(--radius-md) border border-line bg-white shadow-(--shadow-card)">
          {matches.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => selectProduct(product)}
              className="flex w-full cursor-pointer items-center gap-2.5 border-b border-line p-2 text-left last:border-b-0 hover:bg-cream"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-(--radius-sm) border border-line">
                <ProductImage src={product.image_ready ? product.image_url : null} alt={product.display_name} height={40} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-ink">{product.display_name}</div>
                <div className="truncate text-[11px] text-muted">
                  {[product.brand, product.subcategory ?? product.category].filter(Boolean).join(" · ")}
                </div>
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={selectCustom}
            className="flex w-full cursor-pointer items-center gap-2 p-2.5 text-left hover:bg-cream"
          >
            <Plus className="h-4 w-4 text-oak" aria-hidden="true" />
            <span className="text-[13px] font-medium text-oak">Add &ldquo;{query.trim()}&rdquo; as a custom item</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
