"use client";

import * as React from "react";
import Link from "next/link";
import { HeroImage } from "@/components/ui/hero-image";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { WatchItemDetailModal } from "@/components/shell/watch-item-detail-modal";
import { useAppShell } from "@/components/shell/app-shell-context";
import { DEPARTMENT_HERO_IMAGES } from "@/lib/assets";
import type { Athlete } from "@/lib/data/athletes";
import type { WatchItem } from "@/lib/data/watch";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { AddItemBar } from "@/components/ui/add-item-bar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/shell/toast-context";
import type { HouseholdPerson } from "@/lib/household/people";
import { addAthlete, removeAthlete } from "./actions";

export function SportsView({
  athletes,
  watchCountByAthlete,
  equipmentWatch,
  people,
}: {
  athletes: Athlete[];
  watchCountByAthlete: Map<string, number>;
  equipmentWatch: WatchItem[];
  people: HouseholdPerson[];
}) {
  const [selected, setSelected] = React.useState<WatchItem | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const { openAddWatch } = useAppShell();
  const router = useRouter();
  const showToast = useToast();
  const [pending, startTransition] = React.useTransition();

  function remove(id: string, name: string) {
    startTransition(async () => {
      const res = await removeAthlete(id);
      if (!res.ok) showToast(res.message);
      else {
        showToast(`${name} removed`);
        router.refresh();
      }
    });
  }

  return (
    <div className="pb-8">
      <HeroImage
        src={DEPARTMENT_HERO_IMAGES.sports}
        alt="Mudroom gear room"
        height={170}
        tabletHeight={260}
        radiusClassName="rounded-b-(--radius-xl)"
      />
      <div className="px-5 pt-3.5 pb-1">
        <div className="font-serif text-2xl">Kids Sports</div>
      </div>

      <div className="px-5 pt-3.5 pb-2">
        <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">Athletes</div>
      </div>
      <div className="mb-3 px-5">
        <AddItemBar label="Add an athlete" onClick={() => setAddOpen(true)} />
      </div>
      {athletes.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={Users}
            title="No athletes yet"
            description="Add an athlete above to start tracking their gear and sizes."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {athletes.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-(--radius-md) border border-line bg-white p-3 shadow-(--shadow-card)"
            >
              <Link href={`/rooms/sports/${a.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-sage font-serif text-base font-semibold text-white">
                  {a.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold">{a.name}</div>
                  {a.sport ? <div className="text-[11.5px] text-muted">{a.sport}</div> : null}
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-oak">
                  {watchCountByAthlete.get(a.id) ?? 0} watching
                </span>
              </Link>
              <button
                type="button"
                disabled={pending}
                aria-label={`Remove ${a.name}`}
                onClick={() => remove(a.id, a.name)}
                className="shrink-0 cursor-pointer text-[12px] font-semibold text-muted2 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 pt-4.5 pb-2">
        <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">Equipment Watch</div>
      </div>
      {equipmentWatch.length === 0 ? (
        <div className="px-5">
          <EmptyState title="Nothing being watched" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {equipmentWatch.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="flex items-center gap-2.5 rounded-(--radius-sm) border border-line bg-white p-3 text-left shadow-(--shadow-card)"
            >
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold">{item.title}</div>
                <div className="text-[11px] text-muted">
                  {[item.athlete_name, item.retailer_name].filter(Boolean).join(" · ")}
                </div>
              </div>
              <StatusBadge status={item.price_status} />
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 px-5">
        <Button size="lg" className="w-full" onClick={() => openAddWatch("watch", "sports")}>
          + Add Sports Equipment
        </Button>
      </div>

      <AddAthleteSheet
        key={addOpen ? "athlete-open" : "athlete-closed"}
        open={addOpen}
        people={people}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />

      <WatchItemDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/** Adding an athlete, optionally the same child already on the Family screen. */
function AddAthleteSheet({
  open,
  people,
  onClose,
  onSaved,
}: {
  open: boolean;
  people: HouseholdPerson[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const showToast = useToast();
  const [name, setName] = React.useState("");
  const [sport, setSport] = React.useState("");
  const [personId, setPersonId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save() {
    startTransition(async () => {
      const res = await addAthlete({ name, sport, personId });
      if (!res.ok) showToast(res.message);
      else onSaved();
    });
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="mb-3 text-sm font-semibold">Add an athlete</div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="mb-2" maxLength={60} />
      <Input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Sport — hockey, soccer" className="mb-3" />

      {people.length > 0 ? (
        <>
          <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
            Same person as
          </label>
          {/* The kid who plays hockey is also the kid with the peanut allergy.
              Linking keeps one child from being two unrelated records. */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => setPersonId(personId === person.id ? null : person.id)}
                className={
                  personId === person.id
                    ? "cursor-pointer rounded-(--radius-sm) border border-ink bg-ink px-3 py-1.5 text-[12px] font-semibold text-white"
                    : "cursor-pointer rounded-(--radius-sm) border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink"
                }
              >
                {person.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={pending || name.trim().length === 0} onClick={save}>
          {pending ? "Saving…" : "Add athlete"}
        </Button>
      </div>
    </BottomSheet>
  );
}
