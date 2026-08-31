"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shell/toast-context";
import { cn } from "@/lib/utils";
import type { HouseholdSettings } from "@/lib/data/settings";
import type { Store } from "@/lib/data/stores";
import { saveHouseholdSettings } from "./actions";
import { signOut } from "@/lib/actions/auth-actions";
import { addHouseholdPerson, removeHouseholdPerson } from "@/lib/actions/people-actions";
import { buildJoinLink, type HouseholdPerson } from "@/lib/household/people";
import { DietaryEditor } from "@/components/household/dietary-editor";

const RADIUS_LABELS: { key: string; label: string }[] = [
  { key: "grocery", label: "Grocery Radius" },
  { key: "household", label: "Everyday Household" },
  { key: "sports", label: "Sports" },
  { key: "major", label: "Major Purchase" },
];

export function SettingsView({
  settings,
  stores,
  people,
  siteUrl,
}: {
  settings: HouseholdSettings | null;
  stores: Store[];
  people: HouseholdPerson[];
  siteUrl: string;
}) {
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

      <PeopleSection people={people} />

      {settings?.join_code ? (
        <InviteSection joinCode={settings.join_code} siteUrl={siteUrl} />
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


/**
 * Who is in the household.
 *
 * Separate from who can sign in: a child has no login but a good share of the
 * shopping is for them, and attribution needs a name to point at.
 */
function PeopleSection({ people }: { people: HouseholdPerson[] }) {
  const [editing, setEditing] = React.useState<HouseholdPerson | null>(null);
  const [name, setName] = React.useState("");
  const [isChild, setIsChild] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addHouseholdPerson(name, isChild);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setName("");
      setIsChild(false);
      router.refresh();
    });
  }

  function remove(person: HouseholdPerson) {
    startTransition(async () => {
      const res = await removeHouseholdPerson(person.id);
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  return (
    <section className="mt-5">
      <div className="px-5 pb-2 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        Household
      </div>

      {people.length > 0 ? (
        <div className="mb-2.5 flex flex-col gap-2 px-5">
          {people.map((person) => (
            <div
              key={person.id}
              className="flex items-center justify-between rounded-(--radius-sm) border border-line bg-white px-3.5 py-2.5 shadow-(--shadow-card)"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-ink">{person.name}</span>
                <span className="block text-[11.5px] text-muted">
                  {person.isChild ? "Child" : "Adult"}
                  {person.hasLogin ? " · signs in" : ""}
                </span>
                {/* Allergies are named, never summarised as a count — the whole
                    point of recording one is that somebody can see what it is. */}
                {person.allergies.length > 0 ? (
                  <span className="mt-0.5 block text-[11.5px] font-semibold text-ink">
                    Allergic to {person.allergies.join(", ")}
                  </span>
                ) : null}
                {person.dislikes.length > 0 ? (
                  <span className="block text-[11.5px] text-muted2">
                    Won&rsquo;t eat {person.dislikes.join(", ")}
                  </span>
                ) : null}
              </span>
              <span className="ml-2 flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(person)}
                  className="cursor-pointer text-[12px] font-semibold text-ink"
                >
                  Food
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${person.name}`}
                  disabled={pending}
                  onClick={() => remove(person)}
                  className="cursor-pointer text-[12px] font-semibold text-muted2 disabled:opacity-50"
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-2.5 px-5 text-[12.5px] text-muted">
          Add the people you shop for, so purchases can be attributed to them.
        </p>
      )}

      <form onSubmit={add} className="flex flex-col gap-2 px-5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          maxLength={40}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsChild((v) => !v)}
            className={
              isChild
                ? "cursor-pointer rounded-(--radius-sm) border border-ink bg-ink px-3 py-1.5 text-[12px] font-semibold text-white"
                : "cursor-pointer rounded-(--radius-sm) border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink"
            }
          >
            Child
          </button>
          <Button type="submit" size="sm" disabled={pending || name.trim().length === 0}>
            Add person
          </Button>
        </div>
        {error ? <p className="text-[12.5px] text-[#b5482f]">{error}</p> : null}
      </form>

      <DietaryEditor
        person={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={() => router.refresh()}
      />
    </section>
  );
}

/**
 * Inviting someone.
 *
 * The join code already worked; what did not was getting it from one phone to
 * another without a typo. This shares a link that carries the code, and still
 * shows the code for anyone who would rather type it.
 */
function InviteSection({ joinCode, siteUrl }: { joinCode: string; siteUrl: string }) {
  const [copied, setCopied] = React.useState(false);
  const link = buildJoinLink(siteUrl, joinCode);

  async function share() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Join our HomeAssist", url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed, or the clipboard is blocked — the code below is
      // always readable, so there is nothing to recover from.
    }
  }

  return (
    <section className="mt-5">
      <div className="px-5 pb-2 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        Invite someone
      </div>
      <div className="mx-5 rounded-(--radius-sm) border border-line bg-white px-3.5 py-3 shadow-(--shadow-card)">
        <p className="text-[12.5px] text-muted">
          Send this link. They sign in with their own email and land in this household — the same
          list, pantry and receipts.
        </p>
        <Button size="sm" className="mt-2.5 w-full" onClick={share}>
          {copied ? "Link copied" : "Share invite link"}
        </Button>
        <div className="mt-2.5 flex justify-between border-t border-line pt-2.5">
          <span className="text-[12.5px] text-muted">Or give them this code</span>
          <span className="text-[12.5px] font-semibold text-oak">{joinCode}</span>
        </div>
      </div>
    </section>
  );
}
