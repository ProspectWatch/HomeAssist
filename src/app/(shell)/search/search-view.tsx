"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchHousehold, type SearchGroup, type SearchResult } from "@/lib/data/search";

function ResultRow({ item }: { item: SearchResult }) {
  const body = (
    <div className="flex items-center justify-between gap-3 rounded-(--radius-xs) border border-line bg-white px-3 py-2.5 shadow-(--shadow-card)">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px]">{item.title}</span>
          {item.isRegularBuy ? <Badge variant="oak">Regular</Badge> : null}
        </div>
        {item.sub ? <div className="truncate text-[11px] text-muted">{item.sub}</div> : null}
      </div>
      {item.deal ? (
        <span className="shrink-0 text-[11px] font-semibold text-green">{item.deal}</span>
      ) : null}
    </div>
  );

  return item.href ? (
    <Link href={item.href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function SearchView() {
  const [query, setQuery] = React.useState("");
  const [groups, setGroups] = React.useState<SearchGroup[]>([]);
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
        if (token === latest.current) setGroups(result);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

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
                <ResultRow key={`${group.label}-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
