"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShopTabs } from "@/components/shell/shop-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CollapsibleSection, useSectionState } from "@/components/ui/collapsible-section";
import { useToast } from "@/components/shell/toast-context";
import { describeScreen } from "@/lib/meals/allergens";
import {
  QUICK_MINUTES,
  SLOT_LABEL,
  addDays,
  buildWeek,
  describeWeek,
  type MealSlot,
} from "@/lib/meals/week";
import type { PlannableRecipe, PlannedMealWithScreen } from "@/lib/data/meal-plan";
import type { HouseholdPerson } from "@/lib/household/people";
import { addWeekToList, planMeal, unplanMeal } from "./actions";

type SlotTarget = { date: string; slot: MealSlot } | null;

export function PlanView({
  weekStartIso,
  todayIso,
  meals,
  recipes,
  people,
}: {
  weekStartIso: string;
  todayIso: string;
  meals: PlannedMealWithScreen[];
  recipes: PlannableRecipe[];
  people: HouseholdPerson[];
}) {
  const router = useRouter();
  const showToast = useToast();
  const [target, setTarget] = React.useState<SlotTarget>(null);
  const [pending, startTransition] = React.useTransition();

  const week = React.useMemo(
    () => buildWeek(weekStartIso, meals, todayIso),
    [weekStartIso, meals, todayIso],
  );

  // Days fold, and today opens. A week is browsed one day at a time, and the
  // day you almost always want is the one you are in.
  const sections = useSectionState(`plan-${weekStartIso}`, false);

  function goToWeek(iso: string) {
    router.push(`/shop/plan?week=${iso}`);
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await unplanMeal(id);
      if (!res.ok) showToast(res.message);
      else router.refresh();
    });
  }

  function buildList() {
    startTransition(async () => {
      const res = await addWeekToList(weekStartIso);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      // Say what actually happened. "16 added" when four were already there is
      // a number the list will contradict the moment they look at it.
      const parts = [];
      if (res.added) parts.push(`${res.added} added`);
      if (res.alreadyThere) parts.push(`${res.alreadyThere} already on the list`);
      showToast(parts.length > 0 ? parts.join(", ") : "Nothing new to add");
      router.refresh();
    });
  }

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-2.5">
        <h1 className="font-serif text-[26px] leading-tight text-ink">Plan</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">{describeWeek(weekStartIso)}</p>
      </div>

      <ShopTabs current="/shop/plan" />

      <div className="mb-3 flex items-center gap-2 px-5">
        <Button variant="outline" size="sm" onClick={() => goToWeek(addDays(weekStartIso, -7))}>
          ← Prev
        </Button>
        <Button variant="outline" size="sm" onClick={() => goToWeek(todayIso)} className="flex-1">
          This week
        </Button>
        <Button variant="outline" size="sm" onClick={() => goToWeek(addDays(weekStartIso, 7))}>
          Next →
        </Button>
      </div>

      <div className="mb-4 px-5">
        <Button className="w-full" disabled={pending} onClick={buildList}>
          Add this week&rsquo;s ingredients to the list
        </Button>
      </div>

      {week.map((day) => {
        const filled = day.slots.reduce((n, s) => n + s.meals.length, 0);
        return (
          <CollapsibleSection
            key={day.date}
            title={`${day.dayName} · ${day.shortDate}${day.isToday ? " · Today" : ""}`}
            count={filled}
            open={sections.isOpen(day.date) || day.isToday}
            onToggle={() => sections.toggle(day.date)}
          >
            {day.slots.map((slot) => (
              <div key={slot.slot} className="rounded-(--radius-md) border border-line bg-white p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
                    {slot.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTarget({ date: day.date, slot: slot.slot })}
                    className="cursor-pointer text-[12px] font-semibold text-ink"
                  >
                    + Add
                  </button>
                </div>

                {slot.meals.length === 0 ? (
                  <p className="text-[12.5px] text-muted2">Nothing planned</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {slot.meals.map((meal) => {
                      const warning = meal.screen ? describeScreen(meal.screen) : null;
                      const hasAllergen = (meal.screen?.allergens.length ?? 0) > 0;
                      return (
                        <div key={meal.id} className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] leading-tight font-semibold">
                              {meal.title}
                            </div>
                            <div className="text-[11.5px] text-muted">
                              {meal.personName ?? "Everyone"}
                              {meal.timeMinutes ? ` · ${meal.timeMinutes} min` : ""}
                            </div>
                            {warning ? (
                              <div
                                className={
                                  hasAllergen
                                    ? "mt-1 rounded-(--radius-sm) bg-[#fbeae6] px-2 py-1 text-[11.5px] font-semibold text-[#b5482f]"
                                    : "mt-1 text-[11.5px] text-oak"
                                }
                              >
                                {hasAllergen ? "⚠ " : ""}
                                {warning}
                              </div>
                            ) : null}
                            {/* An unchecked meal is not a clear one, and the
                                difference matters most for the person reading
                                it quickly. */}
                            {meal.screen && !meal.screen.checked ? (
                              <div className="mt-1 text-[11px] text-muted2">
                                No ingredients recorded — not screened
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${meal.title}`}
                            disabled={pending}
                            onClick={() => remove(meal.id)}
                            className="shrink-0 cursor-pointer text-[12px] font-semibold text-muted2 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </CollapsibleSection>
        );
      })}

      <PlanSheet
        // Keyed so a different slot gets a fresh sheet rather than one an
        // effect has to clean up after.
        key={target ? `${target.date}-${target.slot}` : "none"}
        target={target}
        recipes={recipes}
        people={people}
        onClose={() => setTarget(null)}
        onPlanned={() => {
          setTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}

/**
 * Picking what goes in a slot.
 *
 * Recipes suited to this slot come first, then everything else — a recipe
 * tagged for dinner is usually still fine as a lunch, so the rest are pushed
 * down rather than hidden. "Quick" filters to what can be cooked in half an
 * hour, which is the whole question on a hockey night.
 */
function PlanSheet({
  target,
  recipes,
  people,
  onClose,
  onPlanned,
}: {
  target: SlotTarget;
  recipes: PlannableRecipe[];
  people: HouseholdPerson[];
  onClose: () => void;
  onPlanned: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [quickOnly, setQuickOnly] = React.useState(false);
  const [personId, setPersonId] = React.useState<string | null>(null);
  const [custom, setCustom] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const showToast = useToast();

  const ranked = React.useMemo(() => {
    if (!target) return [];
    const q = search.trim().toLowerCase();
    return recipes
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .filter((r) => !quickOnly || (r.timeMinutes !== null && r.timeMinutes <= QUICK_MINUTES))
      .sort(
        (a, b) =>
          Number(b.mealTypes.includes(target.slot)) - Number(a.mealTypes.includes(target.slot)) ||
          (a.timeMinutes ?? 999) - (b.timeMinutes ?? 999) ||
          a.name.localeCompare(b.name),
      );
  }, [recipes, target, search, quickOnly]);

  function submit(recipeId: string | null, title: string | null) {
    if (!target) return;
    startTransition(async () => {
      const res = await planMeal({
        date: target.date,
        slot: target.slot,
        recipeId,
        title,
        personId,
      });
      if (!res.ok) showToast(res.message);
      else onPlanned();
    });
  }

  return (
    <BottomSheet open={target !== null} onClose={onClose}>
      <div className="mb-3 text-sm font-semibold">
        {target ? `${SLOT_LABEL[target.slot]} — ${target.date}` : "Plan a meal"}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setPersonId(null)}
          className={chip(personId === null)}
        >
          Everyone
        </button>
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => setPersonId(person.id)}
            className={chip(personId === person.id)}
          >
            {person.name}
          </button>
        ))}
      </div>

      <div className="mb-2 flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes"
          className="flex-1"
        />
        <button type="button" onClick={() => setQuickOnly((v) => !v)} className={chip(quickOnly)}>
          ≤ {QUICK_MINUTES} min
        </button>
      </div>

      <div className="mb-3 max-h-[38vh] overflow-y-auto">
        {ranked.length === 0 ? (
          <p className="py-3 text-[12.5px] text-muted">
            No recipes match. Type what you&rsquo;re having instead.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {ranked.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                disabled={pending}
                onClick={() => submit(recipe.id, null)}
                className="flex items-center justify-between rounded-(--radius-sm) border border-line bg-white px-3 py-2 text-left disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold">{recipe.name}</span>
                  <span className="block text-[11.5px] text-muted">
                    {recipe.timeMinutes ? `${recipe.timeMinutes} min` : "No time set"}
                    {recipe.ingredients.length > 0
                      ? ` · ${recipe.ingredients.length} ingredients`
                      : " · no ingredients recorded"}
                  </span>
                </span>
                {target && recipe.mealTypes.includes(target.slot) ? (
                  <span className="ml-2 shrink-0 text-[10px] font-semibold text-oak uppercase">
                    Suits
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Or type it — Leftovers, Pizza out"
          className="flex-1"
        />
        <Button
          disabled={pending || custom.trim().length === 0}
          onClick={() => submit(null, custom)}
        >
          Add
        </Button>
      </div>
    </BottomSheet>
  );
}

function chip(active: boolean): string {
  return active
    ? "cursor-pointer rounded-(--radius-sm) border border-ink bg-ink px-3 py-1.5 text-[12px] font-semibold text-white"
    : "cursor-pointer rounded-(--radius-sm) border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink";
}
