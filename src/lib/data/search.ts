"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { searchCatalogProducts } from "@/lib/data/catalog";
import { getPriceBook } from "@/lib/data/price-book";
import { formatCents } from "@/lib/money";
import {
  bestOfferByProduct,
  classifySource,
  describeOffer,
  type ProductOffer,
} from "@/lib/pricing/best-offer";

/**
 * Household-wide search.
 *
 * This used to query `products` — the legacy per-household SKU table, which
 * holds 2 rows — and `watch_items`, which holds none. It could not find any
 * of the 1,663 catalogue products, the household's regular buys, or anything
 * on the grocery list, so searching for something you actually buy returned
 * nothing. It now searches what the household really has.
 *
 * Product results carry what's known about the price, because "do we buy
 * this, what do we pay, and is it on sale" is the question behind almost
 * every search for a product.
 */

export type SearchResult = {
  id: string;
  title: string;
  /** One line of real context. Never padding — omitted when there's nothing true to say. */
  sub: string | null;
  /**
   * The best price the app can currently stand behind, from any source — a
   * flyer sale, a shop's listed price, or what was last paid. Null when there
   * is none, rather than a guess.
   */
  deal: string | null;
  href: string | null;
  isRegularBuy: boolean;
};

export type SearchGroup = { label: string; items: SearchResult[] };

export async function searchHousehold(query: string): Promise<SearchGroup[]> {
  const q = query.trim();
  if (!q) return [];
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return [];

  try {
    const supabase = await createClient();
    const like = `%${q}%`;
    const today = new Date().toISOString().slice(0, 10);

    const [products, groceryRes, receiptsRes, prefRes, recipesRes, book] = await Promise.all([
      searchCatalogProducts(q, 25),
      supabase
        .from("grocery_items")
        .select("id, name, qty, checked")
        .eq("household_id", householdId)
        .ilike("name", like)
        .limit(15),
      supabase
        .from("receipts")
        .select("id, purchased_at, total_cents, retailer:retailers(name)")
        .eq("household_id", householdId)
        .order("purchased_at", { ascending: false })
        .limit(50),
      supabase
        .from("household_product_preferences")
        .select("scope_key")
        .eq("household_id", householdId)
        .eq("scope_type", "product")
        .eq("regular_buy", true),
      supabase.from("recipes").select("id, name").ilike("name", like).limit(10),
      getPriceBook(householdId),
    ]);

    const regularBuys = new Set(
      ((prefRes.data ?? []) as { scope_key: string }[]).map((r) => r.scope_key),
    );

    // Every current price for exactly the products this search returned —
    // flyers, the shops' own listings (Marilu's included), and receipts. This
    // used to filter to FLYER, which hid the 30 Marilu's prices sitting in the
    // same table from a search for anything Marilu's sells.
    const productIds = products.map((p) => p.id);
    const offers: ProductOffer[] = [];
    if (productIds.length > 0) {
      const { data: priceRows } = await supabase
        .from("retailer_price_observations")
        .select(
          "catalog_product_id, observed_price_cents, observed_at, valid_until, source_type, retailer:retailers(name)",
        )
        .eq("household_id", householdId)
        .in("catalog_product_id", productIds)
        .order("observed_at", { ascending: false })
        .limit(600);

      type PriceRow = {
        catalog_product_id: string | null;
        observed_price_cents: number;
        observed_at: string;
        valid_until: string | null;
        source_type: string;
        retailer: { name: string } | null;
      };
      for (const row of (priceRows ?? []) as unknown as PriceRow[]) {
        if (!row.catalog_product_id) continue;
        offers.push({
          catalogProductId: row.catalog_product_id,
          priceCents: row.observed_price_cents,
          retailerName: row.retailer?.name ?? null,
          source: classifySource(row.source_type),
          observedOn: row.observed_at.slice(0, 10),
          validUntil: row.valid_until ? row.valid_until.slice(0, 10) : null,
        });
      }
    }
    const bestByProduct = bestOfferByProduct(offers, today);

    const productItems: SearchResult[] = products.map((product) => {
      const entry = book.get(product.id);
      const offer = bestByProduct.get(product.id);
      const parts = [
        product.brand,
        product.subcategory ?? product.category,
        // Only a price the book can stand behind. A single sighting is
        // reported as what was paid, not as a "usual" price.
        entry
          ? entry.confidence === "THIN"
            ? `paid ${formatCents(entry.lastCents)}`
            : `usually ${formatCents(entry.typicalCents)}`
          : null,
      ].filter((p): p is string => !!p);

      return {
        id: product.id,
        title: product.display_name,
        sub: parts.join(" · ") || null,
        deal: offer ? describeOffer(offer, today) : null,
        href: "/shop/deals",
        isRegularBuy: regularBuys.has(product.id),
      };
    });

    // Receipts match on the store name, which the query above can't filter
    // through the joined table, so it's applied here on real rows.
    const needle = q.toLowerCase();
    type ReceiptRow = {
      id: string;
      purchased_at: string | null;
      total_cents: number | null;
      retailer: { name: string } | null;
    };
    const receiptItems: SearchResult[] = ((receiptsRes.data ?? []) as unknown as ReceiptRow[])
      .filter((r) => (r.retailer?.name ?? "").toLowerCase().includes(needle))
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        title: r.retailer?.name ?? "Unknown store",
        sub: [r.purchased_at, r.total_cents != null ? formatCents(r.total_cents) : null]
          .filter(Boolean)
          .join(" · "),
        deal: null,
        href: `/receipts/${r.id}`,
        isRegularBuy: false,
      }));

    type GroceryRow = { id: string; name: string; qty: string | null; checked: boolean };
    const groceryItems: SearchResult[] = ((groceryRes.data ?? []) as GroceryRow[]).map((row) => ({
      id: row.id,
      title: row.name,
      sub: [row.qty, row.checked ? "done" : null].filter(Boolean).join(" · ") || null,
      deal: null,
      href: "/shop/list",
      isRegularBuy: false,
    }));

    type RecipeRow = { id: string; name: string };
    const recipeItems: SearchResult[] = ((recipesRes.data ?? []) as RecipeRow[]).map((row) => ({
      id: row.id,
      title: row.name,
      sub: null,
      deal: null,
      href: `/shop/recipes/${row.id}`,
      isRegularBuy: false,
    }));

    return [
      { label: "Products", items: productItems },
      { label: "On your list", items: groceryItems },
      { label: "Recipes", items: recipeItems },
      { label: "Receipts", items: receiptItems },
    ].filter((g) => g.items.length > 0);
  } catch {
    return [];
  }
}
