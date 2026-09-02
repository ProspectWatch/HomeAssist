"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { searchHousehold, type SearchGroup, type SearchResult } from "@/lib/data/search";
import { checkPriceNow, type PriceCheckActionResult } from "./actions";

/**
 * A price looked up on demand for one row, replacing what search knew.
 *
 * Kept beside the results rather than folded into them so a check never
 * rewrites a result it didn't cover, and so an in-flight check is visible on
 * the row that started it.
 */
type CheckState = { pending: boolean; result: PriceCheckActionResult | null };

function ResultRow({
  item,
  check,
  onCheck,
}: {
  item: SearchResult;
  check: CheckState | undefined;
  onCheck: (id: string) => void;
}) {
  const checked = check?.result;

  const body = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px]">{item.title}</span>
          {item.isRegularBuy ? <Badge variant="oak">Regular</Badge> : null}
        </div>
        {item.sub ? <div className="truncate text-[11px] text-muted">{item.sub}</div> : null}
      </div>
      {item.deal ? (
        // "on sale $9.99 at Marilu's · seen 2026-08-01" is the whole answer to
        // "where is this on sale", so it wraps rather than being truncated.
        <span className="max-w-[46%] shrink-0 text-right text-[11px] leading-tight font-semibold text-green">
          {item.deal}
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="rounded-(--radius-xs) border border-line bg-white px-3 py-2.5 shadow-(--shadow-card)">
      {item.href ? (
        <Link href={item.href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}

      {item.checkable ? (
        <div className="mt-2 border-t border-line pt-2">
          {check?.pending ? (
            <span className="text-[11px] text-muted">Checking the stores…</span>
          ) : checked ? (
            checked.offers.length > 0 ||
            checked.elsewhere.length > 0 ||
            checked.upcoming.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {checked.offers.map((offer) => (
                  <span
                    key={offer.label}
                    className="text-[11.5px] leading-tight font-semibold text-green"
                  >
                    {offer.label}
                  </span>
                ))}
                {checked.elsewhere.length > 0 ? (
                  <>
                    {/* Real ads in real local flyers, at stores that aren't
                        set up here — so they're shown, not saved. */}
                    <span className="mt-1 text-[10.5px] tracking-[0.06em] text-muted uppercase">
                      Other stores nearby
                    </span>
                    {checked.elsewhere.map((offer) => (
                      <span key={offer.label} className="text-[11.5px] leading-tight text-ink">
                        {offer.label}
                      </span>
                    ))}
                  </>
                ) : null}
                {checked.upcoming.length > 0 ? (
                  <>
                    {/* Next week's flyer, already published. Not a price you
                        can pay today, so it's never shown as one. */}
                    <span className="mt-1 text-[10.5px] tracking-[0.06em] text-muted uppercase">
                      Starting soon
                    </span>
                    {checked.upcoming.map((offer) => (
                      <span key={offer.label} className="text-[11.5px] leading-tight text-ink">
                        {offer.label}
                      </span>
                    ))}
                  </>
                ) : null}
              </div>
            ) : (
              <span className="text-[11px] text-muted">{checked.message}</span>
            )
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="-mx-1.5 h-6 px-1.5"
              onClick={() => onCheck(item.id)}
            >
              {item.deal ? "Check again" : "Check prices now"}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SearchView() {
  const [query, setQuery] = React.useState("");
  const [groups, setGroups] = React.useState<SearchGroup[]>([]);
  const [checks, setChecks] = React.useState<Record<string, CheckState>>({});
  const [pending, startTransition] = React.useTransition();
  // Guards against an earlier, slower request overwriting a later one's
  // results — with debounced typing that reordering is easy to hit.
  const latest = React.useRef(0);

  React.useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const timer = setTimeout(() => {
      const token = ++latest.current;
      startTransition(async () => {
        const result = await searchHousehold(q);
        if (token === latest.current) {
          setGroups(result);
          // A previous query's price checks say nothing about these rows.
          setChecks({});
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const runCheck = React.useCallback((id: string) => {
    setChecks((prev) => ({ ...prev, [id]: { pending: true, result: null } }));
    // Deliberately not in a transition: a store lookup takes seconds, and
    // marking the whole search pending would blank the results while it runs.
    void checkPriceNow(id).then((result) => {
      setChecks((prev) => ({ ...prev, [id]: { pending: false, result } }));
    });
  }, []);

  const searching = query.trim().length > 0;
  // Rendered from the current query rather than cleared in the effect, so an
  // emptied box shows nothing immediately instead of the last search.
  const visible = searching ? groups : [];

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-3">
        <h1 className="mb-2.5 font-serif text-2xl text-ink">Search</h1>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Products, list, recipes, receipts…"
        />
      </div>

      {searching && pending && visible.length === 0 ? (
        <p className="px-5 text-[13px] text-muted">Searching…</p>
      ) : null}

      {searching && !pending && visible.length === 0 ? (
        <p className="px-5 text-[13px] text-muted">No matches for &quot;{query}&quot;</p>
      ) : null}

      <div className="flex flex-col gap-4 px-5">
        {visible.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
              {group.label}
            </div>
            <div className="flex flex-col gap-1.5">
              {group.items.map((item) => (
                <ResultRow
                  key={`${group.label}-${item.id}`}
                  item={item}
                  check={checks[item.id]}
                  onCheck={runCheck}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
