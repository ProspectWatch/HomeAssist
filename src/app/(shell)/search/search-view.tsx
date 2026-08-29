"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { searchHousehold, type SearchGroup } from "@/lib/data/search";

export function SearchView() {
  const [query, setQuery] = React.useState("");
  const [groups, setGroups] = React.useState<SearchGroup[]>([]);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const timer = setTimeout(() => {
      startTransition(async () => setGroups(await searchHousehold(q)));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const displayGroups = query.trim() ? groups : [];

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-3">
        <h1 className="mb-2.5 font-serif text-2xl text-ink">Search</h1>
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search everything…" />
      </div>

      {query.trim() && !pending && displayGroups.length === 0 ? (
        <p className="px-5 text-[13px] text-muted">No matches for &quot;{query}&quot;</p>
      ) : null}

      <div className="flex flex-col gap-4 px-5">
        {displayGroups.map((g) => (
          <div key={g.label}>
            <div className="mb-1.5 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">{g.label}</div>
            <div className="flex flex-col gap-1.5">
              {g.items.map((item, i) => (
                <div
                  key={`${item.title}-${i}`}
                  className="flex justify-between rounded-(--radius-xs) border border-line bg-white px-3 py-2.5 shadow-(--shadow-card)"
                >
                  <span className="text-[13.5px]">{item.title}</span>
                  <span className="text-[11px] text-muted">{item.sub}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
