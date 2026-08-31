"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/nav/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/shell/toast-context";
import { DietaryEditor } from "@/components/household/dietary-editor";
import { addHouseholdPerson, removeHouseholdPerson } from "@/lib/actions/people-actions";
import { setRecipeOpinion } from "./actions";
import type { FamilyMember } from "@/lib/data/family";

/**
 * Everyone in the household, and what the kitchen needs to know about them.
 *
 * This has its own screen because it kept being asked for and kept not being
 * found: the people editor lived inside Settings, which the menu called
 * "Search Settings", so nothing anywhere said "family". A thing nobody can
 * find is not built.
 */
export function FamilyView({
  family,
  recipes,
}: {
  family: FamilyMember[];
  recipes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const showToast = useToast();
  const [name, setName] = React.useState("");
  const [isChild, setIsChild] = React.useState(false);
  const [editing, setEditing] = React.useState<FamilyMember | null>(null);
  const [mealsFor, setMealsFor] = React.useState<FamilyMember | null>(null);
  const [pending, startTransition] = React.useTransition();

  function add(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const res = await addHouseholdPerson(name, isChild);
      if (!res.ok) showToast(res.message);
      else {
        setName("");
        setIsChild(false);
        router.refresh();
      }
    });
  }

  function remove(person: FamilyMember) {
    startTransition(async () => {
      const res = await removeHouseholdPerson(person.id);
      if (!res.ok) showToast(res.message);
      else router.refresh();
    });
  }

  function opinion(person: FamilyMember, recipeId: string, sentiment: "LOVES" | "DISLIKES" | null) {
    startTransition(async () => {
      const res = await setRecipeOpinion(person.id, recipeId, sentiment);
      if (!res.ok) showToast(res.message);
      else router.refresh();
    });
  }

  return (
    <>
      <TopBar title="Family" />

      <div className="px-5 pb-3">
        <p className="text-[12.5px] leading-snug text-muted">
          Who you cook for. Allergies and dislikes here are what the meal planner
          checks a recipe against.
        </p>
      </div>

      {family.length === 0 ? (
        <div className="px-5">
          <EmptyState
            title="Nobody added yet"
            description="Add everyone you cook for — including children, who don't need a login."
          />
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-2 px-5">
          {family.map((person) => {
            const showingMeals = mealsFor?.id === person.id;
            return (
              <div
                key={person.id}
                className="rounded-(--radius-md) border border-line bg-white p-3.5 shadow-(--shadow-card)"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-ink">{person.name}</div>
                    <div className="text-[11.5px] text-muted">
                      {person.isChild ? "Child" : "Adult"}
                      {person.hasLogin ? " · signs in" : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${person.name}`}
                    disabled={pending}
                    onClick={() => remove(person)}
                    className="shrink-0 cursor-pointer text-[12px] font-semibold text-muted2 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>

                {/* Allergies are stated in full and never counted. The whole
                    reason for recording one is that somebody can read it. */}
                {person.allergies.length > 0 ? (
                  <div className="mt-2 rounded-(--radius-sm) bg-[#fbeae6] px-2.5 py-1.5 text-[12px] font-semibold text-[#b5482f]">
                    Allergic to {person.allergies.join(", ")}
                  </div>
                ) : null}
                {person.dislikes.length > 0 ? (
                  <div className="mt-1.5 text-[12px] text-muted">
                    Won&rsquo;t eat {person.dislikes.join(", ")}
                  </div>
                ) : null}
                {person.allergies.length === 0 && person.dislikes.length === 0 ? (
                  <div className="mt-2 text-[12px] text-muted2">
                    No allergies or dislikes recorded
                  </div>
                ) : null}

                {person.loves.length > 0 ? (
                  <div className="mt-1.5 text-[12px] text-oak">
                    Loves {person.loves.map((o) => o.recipeName).join(", ")}
                  </div>
                ) : null}
                {person.refuses.length > 0 ? (
                  <div className="mt-1 text-[12px] text-muted">
                    Refuses {person.refuses.map((o) => o.recipeName).join(", ")}
                  </div>
                ) : null}

                <div className="mt-2.5 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(person)}>
                    Allergies &amp; dislikes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={recipes.length === 0}
                    onClick={() => setMealsFor(showingMeals ? null : person)}
                  >
                    {showingMeals ? "Done" : "Meals"}
                  </Button>
                </div>

                {showingMeals ? (
                  <div className="mt-2.5 border-t border-line pt-2.5">
                    <div className="mb-1.5 text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
                      {person.name}&rsquo;s meals
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {recipes.map((recipe) => {
                        const loves = person.loves.some((o) => o.recipeId === recipe.id);
                        const refuses = person.refuses.some((o) => o.recipeId === recipe.id);
                        return (
                          <div key={recipe.id} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-[13px]">{recipe.name}</span>
                            <span className="flex shrink-0 gap-1.5">
                              {/* Tapping the state it is already in clears it.
                                  Having no view on a meal is a real answer. */}
                              <button
                                type="button"
                                disabled={pending}
                                aria-pressed={loves}
                                onClick={() => opinion(person, recipe.id, loves ? null : "LOVES")}
                                className={pill(loves)}
                              >
                                Loves
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                aria-pressed={refuses}
                                onClick={() => opinion(person, recipe.id, refuses ? null : "DISLIKES")}
                                className={pill(refuses)}
                              >
                                No
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={add} className="flex flex-col gap-2 px-5">
        <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
          Add someone
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          maxLength={40}
        />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setIsChild((v) => !v)} className={pill(isChild)}>
            Child
          </button>
          <Button type="submit" size="sm" disabled={pending || name.trim().length === 0}>
            Add
          </Button>
        </div>
      </form>

      <DietaryEditor
        key={editing?.id ?? "none"}
        person={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={() => router.refresh()}
      />
    </>
  );
}

function pill(active: boolean): string {
  return active
    ? "cursor-pointer rounded-(--radius-sm) border border-ink bg-ink px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
    : "cursor-pointer rounded-(--radius-sm) border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-50";
}
