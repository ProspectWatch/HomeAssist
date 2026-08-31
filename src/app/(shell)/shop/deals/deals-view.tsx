"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Info, Plus, RefreshCw, Tag, TrendingDown, TrendingUp } from "lucide-react";
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
import type { DealGroup } from "@/lib/data/flyer-deals";
import { addDealToList, logSeenPrice, scanFlyerDeals, scanMarilusPrices } from "./actions";

const VERDICT_STYLES: Record<PriceVerdictCode, { className: string; icon: typeof TrendingDown }> = {
  BEST_EVER: { className: "border-green bg-green/10 text-ink", icon: TrendingDown },
  GOOD: { className: "border-green bg-green/10 text-ink", icon: TrendingDown },
  TYPICAL: { className: "border-line bg-cream/60 text-ink", icon: Info },
  HIGH: { className: "border-oak bg-oak/15 text-ink", icon: TrendingUp },
  NO_HISTORY: { className: "border-line bg-cream/60 text-ink", icon: Info },
};

function formatDeadline(validUntil: string | null): string | null {
  if (!validUntil) return null;
  const end = new Date(`${validUntil}T12:00:00Z`);
  const today = new Date();
  const days = Math.round((end.getTime() - today.getTime()) / 86400000);
  if (days < 0) return null;
  if (days === 0) return "ends today";
  if (days === 1) return "ends tomorrow";
  return `ends ${end.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}`;
}

function DealGroupCard({ group }: { group: DealGroup }) {
  const [adding, startAdd] = React.useTransition();
  const [added, setAdded] = React.useState(false);
  // Which store's offer goes on the list. Defaults to the cheapest because
  // that is usually the answer, but it is a default and not a decision: the
  // cheapest shop is often not the one you are driving to, and adding Pork
  // Back Ribs "at Food Basics" when you are going to Fortinos puts the wrong
  // price and the wrong store on the list.
  const [chosenId, setChosenId] = React.useState(group.offers[0]?.id ?? null);
  const showToast = useToast();
  const router = useRouter();

  const best = group.offers[0];
  const chosen = group.offers.find((o) => o.id === chosenId) ?? best;
  const strong = group.verdict?.code === "BEST_EVER" || group.verdict?.code === "GOOD";

  function addToList() {
    startAdd(async () => {
      const res = await addDealToList({
        catalogProductId: group.catalogProductId,
        name: group.name,
        retailerName: chosen.retailerName,
        priceCents: chosen.priceCents,
        validUntil: chosen.validUntil,
      });
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      setAdded(true);
      showToast(res.alreadyOnList ? `${group.name} is already on your list` : `${group.name} added to your list`);
      router.refresh();
    });
  }

  return (
    <div
      className={`flex gap-3 rounded-(--radius-md) border bg-white p-3 shadow-(--shadow-card) ${
        strong ? "border-green" : "border-line"
      }`}
    >
      <ProductImage
        src={group.imageUrl}
        alt={group.name}
        height={60}
        category={group.category}
        className="w-15 shrink-0 overflow-hidden rounded-(--radius-sm) border border-line"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate text-sm font-semibold">{group.name}</div>
          {group.isRegularBuy ? <Badge variant="oak">Regular</Badge> : null}
        </div>

        {/* One line per store, cheapest first — the comparison is the point —
            and each one is selectable, because comparing is only half of it. */}
        <div className="flex flex-col gap-1">
          {group.offers.map((offer, i) => {
            const deadline = formatDeadline(offer.validUntil);
            const picked = offer.id === chosen.id;
            return (
              <button
                key={offer.id}
                type="button"
                aria-pressed={picked}
                onClick={() => {
                  setChosenId(offer.id);
                  setAdded(false);
                }}
                className={`flex items-baseline justify-between gap-2 rounded-(--radius-sm) px-1.5 py-1 text-left ${
                  picked ? "bg-cream ring-1 ring-oak" : ""
                }`}
              >
                <div className="min-w-0">
                  <span
                    className={`text-[13px] font-bold ${i === 0 ? "text-ink" : "text-muted"}`}
                  >
                    {offer.retailerName ?? "Store not identified"}
                  </span>
                  {deadline ? (
                    <span className="ml-1.5 text-[10.5px] text-muted2">{deadline}</span>
                  ) : null}
                  {offer.rawName ? (
                    <div className="truncate text-[10.5px] text-muted2">{offer.rawName}</div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`text-[13.5px] font-semibold ${i === 0 ? "text-green" : "text-muted"}`}
                  >
                    {formatCents(offer.priceCents)}
                  </span>
                  {offer.regularPriceCents && offer.regularPriceCents > offer.priceCents ? (
                    <span className="ml-1 text-[10.5px] text-muted2 line-through">
                      {formatCents(offer.regularPriceCents)}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {group.offers.length > 1 && group.spreadCents > 0 ? (
          <div className="text-[11px] font-semibold text-oak">
            {formatCents(group.spreadCents)} cheaper at {best.retailerName ?? "the first store"}
          </div>
        ) : null}

        {group.verdict ? (
          <p className="text-[11px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">{group.verdict.headline}.</span>{" "}
            {group.verdict.detail}
          </p>
        ) : (
          <p className="text-[11px] text-muted2">No price history for this yet — nothing to compare it against.</p>
        )}

        {group.offers.some((o) => o.isMultiItemOffer) ? (
          <p className="text-[10.5px] text-muted2">
            At least one of these flyer offers covers more than one product — check the wording before counting on it.
          </p>
        ) : null}

        <button
          type="button"
          onClick={addToList}
          disabled={adding || added}
          className="mt-1 flex w-fit cursor-pointer items-center gap-1 rounded-(--radius-sm) border border-line px-2 py-1 text-[11px] font-semibold text-ink disabled:opacity-60"
        >
          {added ? <Check className="h-3 w-3" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
          {/* The store is named on the button so the choice is visible at the
              moment of committing to it, not two taps earlier. */}
          {added
            ? "On your list"
            : adding
              ? "Adding…"
              : `Add to list${chosen.retailerName ? ` — ${chosen.retailerName}` : ""}`}
        </button>
      </div>
    </div>
  );
}

export function DealsView({
  book,
  bestPrices,
  stores,
  liveDeals,
  onlinePrices,
  lastScan,
}: {
  book: Record<string, PriceBookEntry>;
  bestPrices: BestPrice[];
  stores: Store[];
  liveDeals: DealGroup[];
  onlinePrices: DealGroup[];
  lastScan: { finishedAt: string; status: string; pricesFound: number; error: string | null } | null;
}) {
  const { products, loading } = useCatalog();
  const showToast = useToast();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const [scanning, startScan] = React.useTransition();
  const [scanNote, setScanNote] = React.useState<string | null>(null);
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

  function scan() {
    startScan(async () => {
      const res = await scanFlyerDeals();
      if (!res.ok) {
        setScanNote(null);
        showToast(res.message);
        return;
      }
      setScanNote([res.summary, res.detail].filter(Boolean).join(" "));
      showToast(res.summary ?? "Flyer scan finished");
      router.refresh();
    });
  }

  // Marilu's is a separate button because it is a separate kind of source: no
  // flyer exists for it, and what comes back is an Instacart listing rather
  // than a shelf price. Folding it into "Check prices" would hide both facts.
  function scanMarilus() {
    startScan(async () => {
      const res = await scanMarilusPrices();
      if (!res.ok) {
        setScanNote(null);
        showToast(res.message);
        return;
      }
      setScanNote([res.summary, res.detail].filter(Boolean).join(" "));
      showToast(res.summary ?? "Marilu's prices checked");
      router.refresh();
    });
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

      {/* ---- Scan control ---- */}
      <div className="mx-5 mb-3.5 rounded-(--radius-sm) border border-line bg-white px-3.5 py-2.5 shadow-(--shadow-card)">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 text-[11.5px] text-muted">
            {lastScan ? (
              <>
                Prices checked{" "}
                <span className="font-semibold text-ink">
                  {new Date(lastScan.finishedAt).toLocaleString("en-CA", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </>
            ) : (
              "Prices haven't been checked yet"
            )}
          </div>
          <button
            type="button"
            onClick={scan}
            disabled={scanning}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold text-ink disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} aria-hidden="true" />
            {scanning ? "Checking…" : "Check prices"}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
          <div className="min-w-0 text-[11.5px] text-muted">
            Marilu&rsquo;s has no flyer — its prices come from its Instacart listing
          </div>
          <button
            type="button"
            onClick={scanMarilus}
            disabled={scanning}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold text-ink disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} aria-hidden="true" />
            {scanning ? "Checking…" : "Check Marilu's"}
          </button>
        </div>
        {scanNote ? <p className="mt-1.5 text-[11px] leading-relaxed text-muted2">{scanNote}</p> : null}
      </div>

      {/* ---- This week's flyer deals ---- */}
      <section className="mx-5 mb-3.5">
        <h2 className="mb-1.5 font-serif text-base font-semibold">On sale this week</h2>
        {liveDeals.length === 0 ? (
          <EmptyState
            icon={Tag}
            title={lastScan ? "No live deals right now" : "No flyers checked yet"}
            description={
              lastScan
                ? "Nothing in this week's flyers matched the products you buy. Check again after the new flyers land — most drop Thursday."
                : "Tap Check prices to search this week's flyers and the retailers' websites for the things you actually buy."
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {liveDeals.map((group) => (
              <DealGroupCard key={group.catalogProductId} group={group} />
            ))}
          </div>
        )}
      </section>

      {/* ---- Website prices ---- */}
      {onlinePrices.length > 0 ? (
        <section className="mx-5 mb-3.5">
          <h2 className="mb-0.5 font-serif text-base font-semibold">Online right now</h2>
          <p className="mb-1.5 text-[11.5px] text-muted">
            Website prices, not advertised sales — and you can order these wherever you live.
          </p>
          <div className="flex flex-col gap-2">
            {onlinePrices.map((group) => (
              <DealGroupCard key={group.catalogProductId} group={group} />
            ))}
          </div>
        </section>
      ) : null}

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

      {/* ---- Where the deal data comes from ---- */}
      <section className="mx-5 rounded-(--radius-sm) border border-line bg-cream/50 p-3.5">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="text-[12px] font-semibold">Where these come from</span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          This week&apos;s printed flyers for your postal code, filtered to the stores you shop at and matched
          against the products you buy. Flyer prices are advertised sale prices, so they&apos;re kept out of your
          price book&apos;s &ldquo;usual&rdquo; — the book is what you actually pay, and it&apos;s what judges these deals.
          Store shelf prices aren&apos;t available: both Loblaw banners refuse automated access.
        </p>
        <Link href="/price-history" className="mt-1.5 inline-block text-[11.5px] font-semibold text-ink">
          See your full price book →
        </Link>
      </section>
    </div>
  );
}
