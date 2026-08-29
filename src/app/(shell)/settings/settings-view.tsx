"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shell/toast-context";
import type { HouseholdSettings } from "@/lib/data/settings";
import { saveHouseholdSettings } from "./actions";

const RADIUS_LABELS: { key: string; label: string }[] = [
  { key: "grocery", label: "Grocery Radius" },
  { key: "household", label: "Everyday Household" },
  { key: "sports", label: "Sports" },
  { key: "major", label: "Major Purchase" },
];

export function SettingsView({ settings }: { settings: HouseholdSettings | null }) {
  const [postal, setPostal] = React.useState(settings?.postal_code ?? "");
  const [city, setCity] = React.useState(settings?.city ?? "");
  const [pending, startTransition] = React.useTransition();
  const showToast = useToast();

  function save() {
    startTransition(async () => {
      const res = await saveHouseholdSettings({ postalCode: postal, city });
      showToast(res.ok ? "Settings saved" : res.message);
    });
  }

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-3.5">
        <h1 className="font-serif text-2xl text-ink">Search Settings</h1>
      </div>

      <Card className="mx-5 mb-3.5 p-3.5">
        <div className="mb-2 text-[12.5px] font-semibold">Home Postal Code</div>
        <div className="flex gap-2">
          <Input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="Not set" />
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
        </div>
        <Button size="sm" className="mt-2.5" disabled={pending} onClick={save}>
          Save
        </Button>
      </Card>

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

      <div className="mx-5 mt-3.5 flex justify-between rounded-(--radius-sm) border border-line bg-white px-3.5 py-2.5 shadow-(--shadow-card)">
        <span className="text-[13px]">Preferred Store</span>
        <span className="text-[13px] font-semibold">{settings?.preferred_retailer_name ?? "Not set"}</span>
      </div>
    </div>
  );
}
