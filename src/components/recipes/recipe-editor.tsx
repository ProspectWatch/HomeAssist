"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/shell/toast-context";
import { MEAL_SLOTS, SLOT_LABEL, type MealSlot } from "@/lib/meals/week";
import { deleteRecipe, updateRecipe } from "@/app/(shell)/shop/recipes/[id]/actions";
import type { RecipeDetail } from "@/lib/data/recipes";

/**
 * Editing a recipe after it has been saved.
 *
 * Same shape as the review step an import ends at, because it is the same job:
 * an imported recipe is a reading of somebody else's page and a typed one is
 * somebody's memory, and both turn out to need correcting. Ingredients are one
 * per line — the only way to fix a list on a phone that doesn't involve a row
 * of tiny buttons.
 *
 * Seeded from props at mount; the caller remounts it with a key rather than
 * copying props into state in an effect.
 */
export function RecipeEditor({
  recipe,
  open,
  onClose,
}: {
  recipe: RecipeDetail;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [name, setName] = React.useState(recipe.name);
  const [minutes, setMinutes] = React.useState(
    recipe.time_minutes ? String(recipe.time_minutes) : "",
  );
  const [servings, setServings] = React.useState(recipe.servings ?? "");
  const [notes, setNotes] = React.useState(recipe.notes ?? "");
  const [slots, setSlots] = React.useState<MealSlot[]>(
    recipe.meal_types.filter((t): t is MealSlot => MEAL_SLOTS.includes(t as MealSlot)),
  );
  const [ingredientText, setIngredientText] = React.useState(
    recipe.ingredients.map((i) => i.name).join("\n"),
  );
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateRecipe({
        recipeId: recipe.id,
        name,
        timeMinutes: minutes.trim() ? Number(minutes) : null,
        servings,
        mealTypes: slots,
        notes,
        ingredients: ingredientText.split("\n"),
      });
      if (!res.ok) showToast(res.message);
      else {
        showToast("Recipe updated");
        onClose();
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteRecipe(recipe.id);
      if (!res.ok) showToast(res.message);
      else {
        showToast(`${recipe.name} deleted`);
        router.replace("/shop/recipes");
      }
    });
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="mb-3 text-sm font-semibold">Edit recipe</div>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Recipe name"
        className="mb-2"
      />
      <div className="mb-2 flex gap-2">
        <Input
          value={minutes}
          onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Minutes"
          inputMode="numeric"
          className="flex-1"
        />
        <Input
          value={servings}
          onChange={(e) => setServings(e.target.value)}
          placeholder="Serves 4"
          className="flex-1"
        />
      </div>

      <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        Good for
      </label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {MEAL_SLOTS.map((slot) => {
          const on = slots.includes(slot);
          return (
            <button
              key={slot}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setSlots((prev) => (on ? prev.filter((s) => s !== slot) : [...prev, slot]))
              }
              className={
                on
                  ? "cursor-pointer rounded-(--radius-sm) border border-ink bg-ink px-3 py-1.5 text-[12px] font-semibold text-white"
                  : "cursor-pointer rounded-(--radius-sm) border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink"
              }
            >
              {SLOT_LABEL[slot]}
            </button>
          );
        })}
      </div>

      <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        Ingredients — one per line
      </label>
      {/* Said plainly, because it is the one thing about editing that is not
          obvious: a line left alone keeps the pantry link that tells the
          recipe whether you have it. */}
      <p className="mb-1.5 text-[11px] leading-snug text-muted">
        Lines you leave alone keep their pantry match. Reordering is free; rewording a
        line makes it a new one.
      </p>
      <textarea
        value={ingredientText}
        onChange={(e) => setIngredientText(e.target.value)}
        rows={10}
        className="mb-3 w-full rounded-(--radius-sm) border border-line bg-white px-3 py-2 text-[13.5px] leading-relaxed"
      />

      <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
        Notes
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Where it came from, what you change when you make it"
        className="mb-3 w-full rounded-(--radius-sm) border border-line bg-white px-3 py-2 text-[13px] leading-relaxed"
      />

      <div className="mb-3 flex gap-2">
        <Button variant="outline" className="flex-1" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={pending || name.trim().length === 0 || ingredientText.trim().length === 0}
          onClick={save}
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* Delete asks once, in the sheet, naming the recipe. A destructive
          action behind a single tap on a phone is a mis-tap waiting to
          happen. */}
      <div className="border-t border-line pt-3">
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-[12px] text-muted">
              Delete {recipe.name}? Its photos go too. Anything already on the shopping
              list stays.
            </span>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirmingDelete(false)}>
              Keep
            </Button>
            <Button variant="danger" size="sm" disabled={pending} onClick={remove}>
              Delete
            </Button>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingDelete(true)}
            className="cursor-pointer text-[12px] font-semibold text-[#b5482f] disabled:opacity-50"
          >
            Delete this recipe
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
