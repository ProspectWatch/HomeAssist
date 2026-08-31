"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/shell/toast-context";
import { MEAL_SLOTS, SLOT_LABEL, type MealSlot } from "@/lib/meals/week";
import {
  importRecipeFromScreenshot,
  importRecipeFromUrl,
  saveImportedRecipe,
} from "@/app/(shell)/shop/recipes/import-actions";
import type { ImportedRecipe } from "@/lib/recipes/import-url";

/**
 * Adding a recipe from a link, a screenshot, or by hand.
 *
 * Every route ends at the same review step rather than saving straight off.
 * An import is a reading of somebody else's page and can be partial; the
 * ingredient list is exactly the thing worth a glance before it starts
 * generating shopping lists, and a missing line is much cheaper to notice here
 * than at the stove.
 */
export function RecipeImport({
  open,
  onClose,
  screenshotAvailable,
}: {
  open: boolean;
  onClose: () => void;
  screenshotAvailable: boolean;
}) {
  const router = useRouter();
  const showToast = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [url, setUrl] = React.useState("");
  const [draft, setDraft] = React.useState<ImportedRecipe | null>(null);
  const [ingredientText, setIngredientText] = React.useState("");
  const [name, setName] = React.useState("");
  const [minutes, setMinutes] = React.useState("");
  const [servings, setServings] = React.useState("");
  const [slots, setSlots] = React.useState<MealSlot[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) {
      setUrl("");
      setDraft(null);
      setIngredientText("");
      setName("");
      setMinutes("");
      setServings("");
      setSlots([]);
    }
  }, [open]);

  function loadDraft(recipe: ImportedRecipe) {
    setDraft(recipe);
    setName(recipe.name);
    setMinutes(recipe.timeMinutes ? String(recipe.timeMinutes) : "");
    setServings(recipe.servings ?? "");
    setIngredientText(recipe.ingredients.join("\n"));
  }

  function fromUrl() {
    setBusy(true);
    startTransition(async () => {
      const res = await importRecipeFromUrl(url);
      setBusy(false);
      if (!res.ok) showToast(res.message);
      else loadDraft(res.recipe);
    });
  }

  async function fromScreenshot(file: File) {
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const res = await importRecipeFromScreenshot({
        base64: btoa(binary),
        mediaType: file.type,
      });
      if (!res.ok) showToast(res.message);
      else loadDraft(res.recipe);
    } finally {
      setBusy(false);
    }
  }

  function save() {
    startTransition(async () => {
      const res = await saveImportedRecipe({
        name,
        timeMinutes: minutes.trim() ? Number(minutes) : null,
        servings: servings.trim() || null,
        mealTypes: slots,
        ingredients: ingredientText.split("\n"),
        sourceUrl: draft?.sourceUrl || null,
      });
      if (!res.ok) showToast(res.message);
      else {
        showToast(`${name} saved`);
        onClose();
        router.refresh();
      }
    });
  }

  const working = busy || pending;

  return (
    <BottomSheet open={open} onClose={onClose}>
      {draft === null ? (
        <>
          <div className="mb-3 text-sm font-semibold">Add a recipe</div>

          <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
            From a link
          </label>
          <div className="mb-1.5 flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="flex-1"
            />
            <Button disabled={working || url.trim().length === 0} onClick={fromUrl}>
              {working ? "…" : "Read"}
            </Button>
          </div>
          <p className="mb-4 text-[11.5px] leading-snug text-muted">
            Reads the recipe the site publishes for search engines. Most recipe sites
            do; a blog post might not, and it will say so rather than guess.
          </p>

          {screenshotAvailable ? (
            <>
              <label className="mb-1 block text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
                From a screenshot
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void fromScreenshot(file);
                }}
              />
              <Button
                variant="outline"
                className="mb-1.5 w-full"
                disabled={working}
                onClick={() => fileRef.current?.click()}
              >
                {working ? "Reading…" : "Choose a screenshot"}
              </Button>
              <p className="mb-4 text-[11.5px] leading-snug text-muted">
                For a cookbook photo or a site that won&rsquo;t give up its recipe.
                Transcribes what it can read and leaves out what it can&rsquo;t — check
                the list against the original.
              </p>
            </>
          ) : null}

          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              loadDraft({ name: "", timeMinutes: null, servings: null, ingredients: [], sourceUrl: "" })
            }
          >
            Type it in by hand
          </Button>
        </>
      ) : (
        <>
          <div className="mb-1 text-sm font-semibold">Check it over</div>
          <p className="mb-3 text-[11.5px] text-muted">
            Edit anything that came through wrong before saving.
          </p>

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
          <textarea
            value={ingredientText}
            onChange={(e) => setIngredientText(e.target.value)}
            rows={8}
            placeholder={"2 salmon fillets\n1 lemon\nOlive oil"}
            className="mb-3 w-full rounded-(--radius-sm) border border-line bg-white px-3 py-2 text-[13.5px] leading-relaxed"
          />

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDraft(null)}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={working || name.trim().length === 0 || ingredientText.trim().length === 0}
              onClick={save}
            >
              {working ? "Saving…" : "Save recipe"}
            </Button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
