"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Info, Tag, TrendingDown, TrendingUp } from "lucide-react";
import { ShopTabs } from "@/components/shell/shop-tabs";
import { ProductImage } from "@/components/ui/product-image";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/shell/toast-context";
import { useCatalog } from "@/lib/use-catalog";
import { searchCatalog } from "@/lib/catalog-search";
import { formatCents } from "@/lib/money";
import { assessPrice, type PriceBookEntry, type PriceVerdictCode } from "@/lib/pricing/price-book";
import { parsePriceInput } from "@/lib/pricing/parse-price";
import type { CatalogProduct } from "@/lib/data/catalog";
import type { Store } from "@/lib/data/stores";
import type { BestPrice } from "@/lib/data/deals";
import { logSeenPrice } from "./actions";

const VERDICT_STYLES: Record<PriceVerdictCode, { className: string; icon: typeof TrendingDown }> = {
  BEST_EVER: { className: "border-green bg-green/10 text-ink", icon: TrendingDown },
  GOOD: { className: "border-green bg-green/10 text-ink", icon: TrendingDown },
  TYPICAL: { className: "border-line bg-cream/60 text-ink", icon: Info },
  HIGH: { className: "border-oak bg-oak/15 text-ink", icon: TrendingUp },
  NO_HISTORY: { className: "border-line bg-cream/60 text-ink", icon: Info },
};

export function DealsView({
  book,
  bestPrices,
  stores,
}: {
  book: Record<string, PriceBookEntry>;
  bestPrices: BestPrice[];
  stores: Store[];
}) {
  const { products, loading } = useCatalog();
  const showToast = useToast();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<CatalogProduct | null>(null);
  const [priceText, setPriceText] = React.useState("");
  const [storeId, setStoreId] = React.useState("");

  const results = React.useMemo(
    () => (picked || query.trim().length < 2 ? [] : searchCatalog(products, query, 8)),
    [products, query, picked],
  );

  const priceCents = parsePriceInput(priceText);
  const entry = picked ? (book[picked.id] ?? null) : null;
  const verdict = picked && priceCents !== null ? assessPrice(entry, priceCents) : null;
  const style = verdict ? VERDICT_STYLES[verdict.code] : null;
  const VerdictIcon = style?.icon ?? Info;

  function reset() {
    setPicked(null);
    setQuery("");
    setPriceText("");
  }

  function save() {
    if (!picked || priceCents === null) return;
    startTransition(async () => {
      const res = await logSeenPrice({ catalogProductId: picked.id, retailerId: storeId, priceCents });
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      showToast(`${formatCents(priceCents)} for ${picked.display_name} added to your price book`);
      reset();
      router.refresh();
    });
  }

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-2.5">
        <h1 className="font-serif text-[26px] leading-tight text-ink">Deals</h1>
      </div>
      <ShopTabs current="/shop/deals" />

      {/* ---- Price check ---- */}
      <section className="mx-5 mb-3.5 rounded-(--radius-lg) border border-line bg-white p-3.5 shadow-(--shadow-card)">
        <h2 className="font-serif text-base font-semibold">Is this a good price?</h2>
        <p className="mt-0.5 mb-2.5 text-[11.5px] text-muted">
          Check a shelf or flyer price against what your household has actually paid.
        </p>

        {picked ? (
          <div className="mb-2.5 flex items-center gap-2.5 rounded-(--radius-sm) border border-line bg-cream/40 p-2">
            <ProductImage
              src={picked.image_ready ? picked.image_url : null}
              alt={picked.display_name}
              height={40}
              category={picked.category}
              className="w-10 shrink-0 overflow-hidden rounded-[6px]"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{picked.display_name}</div>
              <div className="truncate text-[11px] text-muted">{picked.category}</div>
            </div>
            <button type="button" onClick={reset} className="cursor-pointer text-[11.5px] font-semibold text-muted">
              Change
            </button>
          </div>
        ) : (
          <>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={loading ? "Loading catalogue…" : "What are you looking at?"}
              aria-label="Find a product to price check"
            />
            {results.length > 0 ? (
              <ul className="mt-1.5 flex flex-col gap-1">
                {results.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(product)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-(--radius-sm) border border-line px-2 py-1.5 text-left"
                    >
                      <span className="flex-1 truncate text-[12.5px] font-medium">{product.display_name}</span>
                      {book[product.id] ? (
                        <span className="shrink-0 text-[10.5px] text-muted">
                          {book[product.id].sightings} on file
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}

        {picked ? (
          <div className="flex items-center gap-2">
            <Input
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder="Price you're seeing, e.g. 5.49"
              inputMode="decimal"
              aria-label="Price you're seeing"
            />
          </div>
        ) : null}

        {verdict && style ? (
          <div className={`mt-2.5 rounded-(--radius-sm) border p-3 ${style.className}`}>
            <div className="flex items-center gap-2">
              <VerdictIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold">{verdict.headline}</span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{verdict.detail}</p>

            {entry && entry.retailers.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {entry.retailers.map((r) => (
                  <span
                    key={r.name}
                    className="rounded-[6px] border border-line bg-white px-2 py-0.5 text-[10.5px] font-semibold"
                  >
                    {r.name} {formatCents(r.bestCents)}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                aria-label="Store you saw this price at"
                className="rounded-(--radius-sm) border border-line bg-white px-2 py-1.5 text-[11.5px]"
              >
                <option value="">Where did you see it?</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              <Button onClick={save} disabled={pending || !storeId}>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {pending ? "Saving…" : "Add to price book"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {/* ---- Where each regular buy has been cheapest ---- */}
      <section className="mx-5 mb-3.5">
        <h2 className="mb-1.5 font-serif text-base font-semibold">Best prices you&apos;ve found</h2>
        {bestPrices.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="Nothing to compare yet"
            description="Once the same product turns up at more than one store — from receipts or prices you log above — the cheaper one shows up here."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {bestPrices.map((item) => (
              <div
                key={item.catalogProductId}
                className="flex items-center gap-3 rounded-(--radius-md) border border-line bg-white p-3 shadow-(--shadow-card)"
              >
                <ProductImage
                  src={item.imageReady ? item.imageUrl : null}
                  alt={item.name}
                  height={44}
                  category={item.category}
                  className="w-11 shrink-0 overflow-hidden rounded-(--radius-sm) border border-line"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{item.name}</span>
                    {item.isRegularBuy ? <Badge variant="oak">Regular</Badge> : null}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted">
                    <span className="font-semibold text-green">{formatCents(item.bestCents)}</span>
                    {item.bestRetailer ? ` at ${item.bestRetailer}` : ""}
                    {item.savingVsTypicalCents > 0
                      ? ` · ${formatCents(item.savingVsTypicalCents)} under your usual ${formatCents(item.typicalCents)}`
                      : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Honest status on live retailer pricing ---- */}
      <section className="mx-5 rounded-(--radius-sm) border border-line bg-cream/50 p-3.5">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="text-[12px] font-semibold">Why there&apos;s no live store feed</span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          The Fortinos and No Frills adapters are built, but both retailers refuse automated access to an
          identified client, and working around their bot controls is out of scope. So this page compares against
          your own record instead — every receipt you scan and every price you log above makes it sharper.
        </p>
        <Link href="/price-history" className="mt-1.5 inline-block text-[11.5px] font-semibold text-ink">
          See your full price book →
        </Link>
      </section>
    </div>
  );
}
