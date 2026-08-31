"use client";

import * as React from "react";
import type { CatalogProduct } from "@/lib/data/catalog";

let cache: CatalogProduct[] | null = null;
let inflight: Promise<CatalogProduct[]> | null = null;

async function fetchProducts(url: string): Promise<CatalogProduct[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: CatalogProduct[] };
    return data.products ?? [];
  } catch {
    return [];
  }
}

/**
 * The shared catalogue plus this household's own branded products, as one
 * index.
 *
 * Two requests rather than one because they cache differently: the catalogue
 * is identical for everyone and held for an hour, while the household's
 * products are theirs alone and must never be served from a shared cache. They
 * are merged here so every caller of the picker gets both without knowing.
 *
 * Where a household product covers the same catalogue concept, it replaces the
 * generic entry rather than sitting beside it — "Heinz Tomato Ketchup" and
 * "Ketchup" as two rows in a typeahead is a choice nobody wants to make.
 */
async function loadCatalog(): Promise<CatalogProduct[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = Promise.all([
      fetchProducts("/api/catalog"),
      fetchProducts("/api/household-products"),
    ]).then(([catalogue, household]) => {
      const owned = new Set(household.map((p) => p.id));
      cache = [...household, ...catalogue.filter((p) => !owned.has(p.id))];
      return cache;
    });
  }
  return inflight;
}

/** Fetches the full catalogue once per browser session, then serves it from memory. */
export function useCatalog(): { products: CatalogProduct[]; loading: boolean } {
  const [products, setProducts] = React.useState<CatalogProduct[]>(cache ?? []);
  const [loading, setLoading] = React.useState(cache === null);

  React.useEffect(() => {
    if (cache) return;
    let cancelled = false;
    loadCatalog().then((data) => {
      if (!cancelled) {
        setProducts(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { products, loading };
}
