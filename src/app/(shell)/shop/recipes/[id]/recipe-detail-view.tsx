"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChefHat, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ProductPicker } from "@/components/catalog/product-picker";
import { RecipePhotoButton } from "@/components/recipes/recipe-photo-button";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { useToast } from "@/components/shell/toast-context";
import { storeBadge } from "@/lib/assets";
import type { IngredientWithStock, RecipeKitchen, RecipePhoto } from "@/lib/data/recipes";
import type { IngredientStock } from "@/lib/recipes/ingredient-match";
import { SLOT_LABEL, type MealSlot } from "@/lib/meals/week";
import type { CatalogProduct } from "@/lib/data/catalog";
import {
  addIngredientToList,
  addMissingIngredientsToList,
  addRecipeToList,
  deleteRecipe,
  removeRecipeImage,
  setRecipeCoverImage,
  setRecipeIngredientCatalogProduct,
} from "./actions";

/**
 * How each state reads on the row. "Not tracked" is its own thing and is
 * never dressed up as "out": the app not knowing about an ingredient is not
 * the same claim as the kitchen not having it, and the difference is a wasted
 * trip to the shop.
 */
const STOCK: Record<IngredientStock, { label: string; className: string }> = {
  IN_STOCK: { label: "Have it", className: "bg-[#e6f0e9] text-[#3F7A55]" },
  LOW: { label: "Low", className: "bg-[#fdf1e0] text-[#9a6a1c]" },
  OUT: { label: "Out", className: "bg-[#fbeae6] text-[#b5482f]" },
  UNKNOWN: { label: "Not checked", className: "bg-cream text-muted" },
  UNTRACKED: { label: "Not tracked", className: "bg-cream text-muted2" },
};

export function RecipeDetailView({ kitchen }: { kitchen: RecipeKitchen }) {
  const { recipe, cover, gallery, ingredients } = kitchen;
  const [pending, startTransition] = React.useTransition();
  const [matchingIngredientId, setMatchingIngredientId] = React.useState<string | null>(null);
  const [viewing, setViewing] = React.useState<RecipePhoto | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [confirmingRemove, setConfirmingRemove] = React.useState(false);
  const router = useRouter();
  const showToast = useToast();

  const missing = ingredients.filter((i) => i.stock === "LOW" || i.stock === "OUT");
  const have = ingredients.filter((i) => i.stock === "IN_STOCK");
  const untracked = ingredients.filter(
    (i) => i.stock === "UNTRACKED" || i.stock === "UNKNOWN",
  );

  function run(work: () => Promise<{ ok: boolean; message?: string }>, done?: string) {
    startTransition(async () => {
      const res = await work();
      if (!res.ok) showToast(res.message ?? "That didn't work.");
      else {
        if (done) showToast(done);
        router.refresh();
      }
    });
  }

  function handleAddAll() {
    startTransition(async () => {
      const res = await addRecipeToList(recipe.id);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      showToast("Ingredients added to list");
      router.push("/shop/list");
    });
  }

  function matchIngredient(ingredientId: string, product: CatalogProduct) {
    startTransition(async () => {
      const res = await setRecipeIngredientCatalogProduct(ingredientId, product.id);
      if (!res.ok) showToast(res.message);
      else {
        setMatchingIngredientId(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="pb-8">
      {/* The cover, or the room to add one. */}
      <div className="relative mb-3.5 h-[190px] overflow-hidden rounded-b-(--radius-xl) bg-cream">
        {cover ? (
          <Image
            src={cover.image_url}
            alt={recipe.name}
            fill
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ChefHat className="h-10 w-10 text-muted2" aria-hidden="true" />
          </div>
        )}
        <div className="absolute right-3 bottom-3">
          <RecipePhotoButton
            recipeId={recipe.id}
            isCover
            label={cover ? "Change cover" : "Add a cover photo"}
            onDone={() => router.refresh()}
            onError={showToast}
          />
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 px-5 pb-1">
        <div className="min-w-0">
          <div className="font-serif text-2xl">{recipe.name}</div>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {recipe.time_minutes ? `${recipe.time_minutes} min` : "—"} · {recipe.servings ?? "—"}
            {recipe.meal_types.length > 0
              ? ` · ${recipe.meal_types.map((t) => SLOT_LABEL[t as MealSlot] ?? t).join(", ")}`
              : ""}
          </div>
        </div>
        {/* Not offered on the starter recipes: that row belongs to every
            household, so RLS refuses the write, and a button that always
            fails is worse than no button. */}
        {recipe.is_shared ? (
          // A starter recipe cannot be edited or deleted — the row is shared
          // with every household. It can be taken off THIS household's list,
          // which is what "I don't want this one" actually means.
          <div className="mt-1 shrink-0 text-right">
            <div className="text-[11px] text-muted2">Starter recipe</div>
            {confirmingRemove ? (
              <div className="mt-1 flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmingRemove(false)}
                  className="cursor-pointer text-[11.5px] font-semibold text-muted disabled:opacity-50"
                >
                  Keep
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await deleteRecipe(recipe.id);
                      if (!res.ok) showToast(res.message);
                      else {
                        showToast(`${recipe.name} removed from your recipes`);
                        router.replace("/shop/recipes");
                      }
                    })
                  }
                  className="cursor-pointer text-[11.5px] font-semibold text-[#b5482f] disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                className="mt-0.5 cursor-pointer text-[12px] font-semibold text-ink"
              >
                Remove
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1 shrink-0 cursor-pointer text-[12.5px] font-semibold text-ink"
          >
            Edit
          </button>
        )}
      </div>
      {recipe.notes ? (
        <p className="px-5 pt-1 text-[12px] leading-snug break-words text-muted">{recipe.notes}</p>
      ) : null}

      {/* ------------------------------------------------------------------
          Ingredients first. The question in front of someone opening a recipe
          is "can I make this tonight", and that is answered by what is
          missing, not by the method.
      ------------------------------------------------------------------ */}
      <div className="px-5 pt-4 pb-1.5">
        <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">
          Ingredients
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">
          {missing.length > 0
            ? `${missing.length} to buy · ${have.length} in the pantry`
            : have.length > 0
              ? `${have.length} in the pantry, nothing marked low or out`
              : "Nothing checked against the pantry yet"}
          {untracked.length > 0 ? ` · ${untracked.length} not tracked` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-2 px-5">
        {ingredients.map((ing) => (
          <IngredientRow
            key={ing.id}
            ingredient={ing}
            disabled={pending}
            // Linking writes to the ingredient row, which on a starter recipe
            // is shared with every household. Own recipes only.
            onLink={recipe.is_shared ? null : () => setMatchingIngredientId(ing.id)}
            onAdd={() =>
              run(
                () =>
                  addIngredientToList({
                    recipeId: recipe.id,
                    name: ing.display_name,
                    qty: ing.qty,
                    catalogProductId: ing.catalog_product_id,
                  }),
                `${ing.display_name} added to list`,
              )
            }
          />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 px-5">
        <Button
          size="lg"
          className="w-full"
          disabled={pending || missing.length === 0}
          onClick={() =>
            run(() => addMissingIngredientsToList(recipe.id), "What we're missing is on the list")
          }
        >
          {missing.length > 0
            ? `Add the ${missing.length} we're low on or out of`
            : "Nothing marked low or out"}
        </Button>
        <Button variant="outline" className="w-full" disabled={pending} onClick={handleAddAll}>
          Add every ingredient to the list
        </Button>
      </div>

      {/* ------------------------------------------------------------------
          Photos
      ------------------------------------------------------------------ */}
      <div className="mt-6 flex items-baseline justify-between px-5 pb-2">
        <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">Photos</div>
        <RecipePhotoButton
          recipeId={recipe.id}
          isCover={false}
          label="+ Add a photo"
          className="cursor-pointer text-[12px] font-semibold text-ink disabled:opacity-50"
          onDone={() => router.refresh()}
          onError={showToast}
        />
      </div>

      {gallery.length === 0 ? (
        <p className="px-5 text-[12px] text-muted2">
          No photos yet — add how it turned out, or a page from the book.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto px-5 pb-1">
          {gallery.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setViewing(photo)}
              className="relative h-[104px] w-[104px] shrink-0 cursor-pointer overflow-hidden rounded-(--radius-md) border border-line"
            >
              <Image
                src={photo.image_url}
                alt={photo.caption ?? `Photo of ${recipe.name}`}
                fill
                sizes="104px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <BottomSheet open={viewing !== null} onClose={() => setViewing(null)}>
        {viewing ? (
          <>
            <div className="relative mb-3 h-[240px] overflow-hidden rounded-(--radius-md) bg-cream">
              <Image
                src={viewing.image_url}
                alt={viewing.caption ?? `Photo of ${recipe.name}`}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() =>
                  run(() => {
                    setViewing(null);
                    return setRecipeCoverImage(recipe.id, viewing.id);
                  }, "Cover updated")
                }
              >
                Make it the cover
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  run(() => {
                    setViewing(null);
                    return removeRecipeImage(recipe.id, viewing.id);
                  }, "Photo removed")
                }
              >
                Remove
              </Button>
            </div>
          </>
        ) : null}
      </BottomSheet>

      {recipe.is_shared ? null : (
        <RecipeEditor
          // Remounted on open so it is seeded from the recipe as it now is,
          // rather than kept in sync by an effect.
          key={editing ? `open-${recipe.id}` : "closed"}
          recipe={recipe}
          open={editing}
          onClose={() => setEditing(false)}
        />
      )}

      <BottomSheet open={matchingIngredientId !== null} onClose={() => setMatchingIngredientId(null)}>
        <div className="mb-1 text-sm font-semibold">Match to a catalogue product</div>
        <p className="mb-3 text-[11.5px] leading-snug text-muted">
          Linking an ingredient to a product is how this line knows whether you have it.
        </p>
        <ProductPicker
          autoFocus
          placeholder="Search products…"
          onSelect={(product) => matchingIngredientId && matchIngredient(matchingIngredientId, product)}
          onCustom={() => setMatchingIngredientId(null)}
        />
      </BottomSheet>
    </div>
  );
}

function IngredientRow({
  ingredient,
  disabled,
  onLink,
  onAdd,
}: {
  ingredient: IngredientWithStock;
  disabled: boolean;
  onLink: (() => void) | null;
  onAdd: () => void;
}) {
  const badge = storeBadge(ingredient.retailer?.name);
  const stock = STOCK[ingredient.stock];
  return (
    <div className="rounded-(--radius-sm) border border-line bg-white p-3 shadow-(--shadow-card)">
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] leading-snug font-semibold">{ingredient.display_name}</div>
          {ingredient.qty ? <div className="text-[11px] text-muted">{ingredient.qty}</div> : null}
          {/* Say what it was read as, so a wrong reading is visible rather
              than silently driving the shopping list. */}
          {ingredient.matched_title ? (
            <div className="mt-0.5 text-[11px] text-muted2">
              {ingredient.matched_how === "catalogue" ? "Linked to" : "Read as"}{" "}
              {ingredient.matched_title}
            </div>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-[6px] px-2 py-[3px] text-[10px] font-semibold ${stock.className}`}
        >
          {stock.label}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {ingredient.already_on_list ? (
          <span className="text-[11.5px] font-semibold text-oak">On the list</span>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={onAdd}
            className="cursor-pointer text-[11.5px] font-semibold text-ink disabled:opacity-50"
          >
            + Add to list
          </button>
        )}
        {onLink ? (
          <button
            type="button"
            onClick={onLink}
            className={`ml-auto flex shrink-0 cursor-pointer items-center gap-1 text-[11px] ${
              ingredient.catalog_product_id ? "text-oak" : "text-muted2"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            {ingredient.catalog_product_id ? "Linked" : "Link a product"}
          </button>
        ) : (
          <span className="ml-auto" />
        )}
        {ingredient.retailer ? (
          <span
            className="rounded-[6px] px-2 py-[3px] text-[10px] font-bold"
            style={{ background: badge.bg, color: badge.color, border: badge.border }}
          >
            {ingredient.retailer.name}
          </span>
        ) : null}
      </div>
    </div>
  );
}
