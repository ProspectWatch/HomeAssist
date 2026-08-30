"use client";

import * as React from "react";
import type { CatalogProduct } from "@/lib/data/catalog";

let cache: CatalogProduct[] | null = null;
let inflight: Promise<CatalogProduct[]> | null = null;

async function loadCatalog(): Promise<CatalogProduct[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch("/api/catalog")
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data: { products: CatalogProduct[] }) => {
        cache = data.products ?? [];
        return cache;
      })
      .catch(() => {
        cache = [];
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
