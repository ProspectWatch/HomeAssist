"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Store } from "@/lib/data/stores";
import { createHousehold, joinHousehold } from "./actions";

export function OnboardingView({ stores }: { stores: Store[] }) {
  const [mode, setMode] = React.useState<"create" | "join">("create");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [householdName, setHouseholdName] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [city, setCity] = React.useState("");
  const [province, setProvince] = React.useState("");
  const [country, setCountry] = React.useState("Canada");
  const [preferredIds, setPreferredIds] = React.useState<string[]>([]);

  const [joinCode, setJoinCode] = React.useState("");

  function toggleStore(id: string) {
    setPreferredIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createHousehold({
        householdName,
        postalCode,
        city,
        province,
        country,
        preferredRetailerIds: preferredIds,
      });
      if (!res.ok) setError(res.message);
    });
  }

  function submitJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await joinHousehold(joinCode);
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <div className="shiplap-bg flex min-h-dvh flex-col items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-serif text-2xl text-ink">Set up your household</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            Create a new household, or join one a family member already started.
          </p>
        </div>

        <div className="mb-4 flex rounded-(--radius-sm) border border-line bg-white p-1">
          {(["create", "join"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                "flex-1 rounded-(--radius-sm) py-2 text-[13px] font-semibold capitalize transition-colors",
                mode === m ? "bg-ink text-white" : "text-muted",
              )}
            >
              {m === "create" ? "Create household" : "Join household"}
            </button>
          ))}
        </div>

        {mode === "create" ? (
          <Card className="p-5">
            <form onSubmit={submitCreate} className="flex flex-col gap-3">
              <Field label="Household name">
                <Input
                  required
                  placeholder="Brown Family"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Postal code">
                  <Input
                    placeholder="L7R 3A1"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                  />
                </Field>
                <Field label="City">
                  <Input
                    placeholder="Burlington"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Province">
                  <Input
                    placeholder="Ontario"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  />
                </Field>
                <Field label="Country">
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                </Field>
              </div>

              {stores.length > 0 ? (
                <div>
                  <div className="mb-1.5 text-[12.5px] font-semibold text-ink">
                    Preferred stores
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {stores.map((s) => {
                      const selected = preferredIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleStore(s.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                            selected
                              ? "border-ink bg-ink text-white"
                              : "border-line bg-white text-ink",
                          )}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                  {preferredIds.length > 0 ? (
                    <p className="mt-1.5 text-[11.5px] text-muted2">
                      Tap in the order you prefer them — {preferredIds.length} selected.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {error ? <p className="text-[12.5px] text-[#b5482f]">{error}</p> : null}

              <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
                {pending ? "Creating…" : "Create household"}
              </Button>
            </form>
          </Card>
        ) : (
          <Card className="p-5">
            <form onSubmit={submitJoin} className="flex flex-col gap-3">
              <Field label="Join code">
                <Input
                  required
                  placeholder="Ask a household member for it"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
              </Field>
              {error ? <p className="text-[12.5px] text-[#b5482f]">{error}</p> : null}
              <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
                {pending ? "Joining…" : "Join household"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[12.5px] font-semibold text-ink">{label}</div>
      {children}
    </div>
  );
}
