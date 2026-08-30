"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ProductPicker } from "@/components/catalog/product-picker";
import { useToast } from "@/components/shell/toast-context";
import { storeBadge } from "@/lib/assets";
import type { RecipeDetail } from "@/lib/data/recipes";
import type { CatalogProduct } from "@/lib/data/catalog";
import { addRecipeToList, setRecipeIngredientCatalogProduct } from "./actions";

export function RecipeDetailView({ recipe }: { recipe: RecipeDetail }) {
  const [pending, startTransition] = React.useTransition();
  const [matchingIngredientId, setMatchingIngredientId] = React.useState<string | null>(null);
  const router = useRouter();
  const showToast = useToast();

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
      <div className="mb-3.5 flex h-[170px] items-center justify-center rounded-b-(--radius-xl) bg-cream">
        <ChefHat className="h-10 w-10 text-muted2" aria-hidden="true" />
      </div>
      <div className="px-5 pb-1">
        <div className="font-serif text-2xl">{recipe.name}</div>
        <div className="mt-0.5 text-[12.5px] text-muted">
          {recipe.time_minutes ? `${recipe.time_minutes} min` : "—"} · {recipe.servings ?? "—"}
        </div>
      </div>

      <div className="px-5 pt-3.5 pb-2">
        <div className="text-[11px] font-semibold tracking-[0.09em] text-oak uppercase">Ingredients</div>
      </div>
      <div className="flex flex-col gap-2 px-5">
        {recipe.ingredients.map((ing) => {
          const badge = storeBadge(ing.retailer?.name);
          return (
            <div
              key={ing.id}
              className="flex items-center gap-2.5 rounded-(--radius-sm) border border-line bg-white p-3 shadow-(--shadow-card)"
            >
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold">{ing.name}</div>
                {ing.qty ? <div className="text-[11px] text-muted">{ing.qty}</div> : null}
              </div>
              <button
                type="button"
                onClick={() => setMatchingIngredientId(ing.id)}
                aria-label="Match to catalogue product"
                className={`shrink-0 cursor-pointer rounded-full p-1.5 ${ing.catalog_product_id ? "text-oak" : "text-muted2"}`}
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>
              {ing.retailer ? (
                <span
                  className="rounded-[6px] px-2 py-[3px] text-[10px] font-bold"
                  style={{ background: badge.bg, color: badge.color, border: badge.border }}
                >
                  {ing.retailer.name}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4.5 px-5">
        <Button size="lg" className="w-full" disabled={pending} onClick={handleAddAll}>
          + Add All Ingredients to List
        </Button>
      </div>

      <BottomSheet open={matchingIngredientId !== null} onClose={() => setMatchingIngredientId(null)}>
        <div className="mb-3 text-sm font-semibold">Match to a catalogue product</div>
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
