"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/shell/toast-context";
import { setPersonDietary } from "@/lib/actions/people-actions";
import type { HouseholdPerson } from "@/lib/household/people";

/**
 * What one person can't have and won't eat.
 *
 * Allergens and dislikes are kept visibly apart, in the copy as well as the
 * data, because they are not the same kind of fact. A dislike is a preference
 * the planner mentions; an allergen is a reason not to serve something. Mixing
 * them into one "food preferences" list is how the important one gets treated
 * like the other.
 */
export function DietaryEditor({
  person,
  open,
  onClose,
  onSaved,
}: {
  person: HouseholdPerson | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Seeded from the person once, on mount. Callers pass a key so a different
  // person remounts this rather than being copied in by an effect — resetting
  // form state from a prop is what `key` is for.
  const [allergies, setAllergies] = React.useState(person?.allergies.join(", ") ?? "");
  const [dislikes, setDislikes] = React.useState(person?.dislikes.join(", ") ?? "");
  const [pending, startTransition] = React.useTransition();
  const showToast = useToast();

  function save() {
    if (!person) return;
    startTransition(async () => {
      const res = await setPersonDietary(person.id, {
        allergies: allergies.split(","),
        dislikes: dislikes.split(","),
      });
      if (!res.ok) showToast(res.message);
      else {
        showToast(`Saved for ${person.name}`);
        onSaved();
        onClose();
      }
    });
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="mb-3 text-sm font-semibold">{person ? `${person.name}'s food` : "Food"}</div>

      <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        Allergies
      </label>
      <Input
        value={allergies}
        onChange={(e) => setAllergies(e.target.value)}
        placeholder="Peanut, Shellfish"
      />
      <p className="mt-1.5 mb-3 text-[11.5px] leading-snug text-muted">
        Separate with commas. Meals are screened by matching these against
        ingredient names — it will catch <em>Peanut</em> in <em>Peanut Butter</em>, but it
        cannot read a packaged product&rsquo;s label. Always check the packet.
      </p>

      <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        Won&rsquo;t eat
      </label>
      <Input
        value={dislikes}
        onChange={(e) => setDislikes(e.target.value)}
        placeholder="Mushrooms, Olives"
      />
      <p className="mt-1.5 mb-4 text-[11.5px] leading-snug text-muted">
        Flagged when planning, never blocking.
      </p>

      <Button className="w-full" disabled={pending} onClick={save}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </BottomSheet>
  );
}
