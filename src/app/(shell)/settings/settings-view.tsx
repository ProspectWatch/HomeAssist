"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shell/toast-context";
import { cn } from "@/lib/utils";
import type { HouseholdSettings } from "@/lib/data/settings";
import type { Store } from "@/lib/data/stores";
import { saveHouseholdSettings } from "./actions";
import { signOut } from "@/lib/actions/auth-actions";

const RADIUS_LABELS: { key: string; label: string }[] = [
  { key: "grocery", label: "Grocery Radius" },
  { key: "household", label: "Everyday Household" },
  { key: "sports", label: "Sports" },
  { key: "major", label: "Major Purchase" },
];

export function SettingsView({ settings, stores }: { settings: HouseholdSettings | null; stores: Store[] }) {
  const [householdName, setHouseholdName] = React.useState(settings?.household_name ?? "");
  const [postal, setPostal] = React.useState(settings?.postal_code ?? "");
  const [city, setCity] = React.useState(settings?.city ?? "");
  const [province, setProvince] = React.useState(settings?.province ?? "");
  const [country, setCountry] = React.useState(settings?.country ?? "");
  const [preferredIds, setPreferredIds] = React.useState<string[]>(settings?.preferred_retailer_ids ?? []);
  const [pending, startTransition] = React.useTransition();
  const [signingOut, startSignOutTransition] = React.useTransition();
  const showToast = useToast();

  function toggleStore(id: string) {
    setPreferredIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function save() {
    startTransition(async () => {
      const res = await saveHouseholdSettings({
        householdName,
        postalCode: postal,
        city,
        province,
        country,
        preferredRetailerIds: preferredIds,
      });
      showToast(res.ok ? "Settings saved" : res.message);
    });
  }

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-3.5">
        <h1 className="font-serif text-2xl text-ink">Household Settings</h1>
      </div>

      <Card className="mx-5 mb-3.5 p-3.5">
        <div className="mb-2 text-[12.5px] font-semibold">Household Name</div>
        <Input value={householdName} onChange={(e) => setHouseholdName(e.target.value)} placeholder="Brown Family" />
      </Card>

      <Card className="mx-5 mb-3.5 p-3.5">
        <div className="mb-2 text-[12.5px] font-semibold">Home Address</div>
        <div className="flex gap-2">
          <Input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="Postal code" />
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
        </div>
        <div className="mt-2 flex gap-2">
          <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Province" />
          <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" />
        </div>
      </Card>

      {stores.length > 0 ? (
        <Card className="mx-5 mb-3.5 p-3.5">
          <div className="mb-2 text-[12.5px] font-semibold">Preferred Stores</div>
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
                    selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
                  )}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      <div className="mx-5 mb-3.5">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save Settings"}
        </Button>
      </div>

      <div className="flex flex-col gap-2 px-5">
        {RADIUS_LABELS.map((r) => (
          <div key={r.key} className="flex justify-between rounded-(--radius-sm) border border-line bg-white px-3.5 py-2.5 shadow-(--shadow-card)">
            <span className="text-[13px]">{r.label}</span>
            <span className="text-[13px] font-semibold text-oak">
              {settings?.search_radii_km[r.key] ? `${settings.search_radii_km[r.key]} km` : "Not set"}
            </span>
          </div>
        ))}
      </div>

      {settings?.join_code ? (
        <div className="mx-5 mt-3.5 flex justify-between rounded-(--radius-sm) border border-line bg-white px-3.5 py-2.5 shadow-(--shadow-card)">
          <span className="text-[13px]">Household Join Code</span>
          <span className="text-[13px] font-semibold text-oak">{settings.join_code}</span>
        </div>
      ) : null}

      <div className="mx-5 mt-5">
        <Button
          variant="danger"
          size="sm"
          disabled={signingOut}
          onClick={() => startSignOutTransition(() => signOut())}
        >
          {signingOut ? "Signing out…" : "Sign Out"}
        </Button>
      </div>
    </div>
  );
}
