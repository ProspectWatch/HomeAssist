import Link from "next/link";
import Image from "next/image";
import { ChefHat } from "lucide-react";
import { ShopTabs } from "@/components/shell/shop-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { getRecipes } from "@/lib/data/recipes";
import { AddRecipeButton } from "@/components/recipes/add-recipe-button";
import { isScreenshotImportConfigured } from "@/lib/recipes/extract-screenshot";

export default async function RecipesPage() {
  const recipes = await getRecipes();
  // Read on the server: whether a provider is configured is a deployment fact,
  // and the key it depends on must never be near the browser.
  const screenshotAvailable = isScreenshotImportConfigured();

  return (
    <div className="pb-8">
      <div className="px-5 pt-4 pb-2.5">
        <h1 className="font-serif text-[26px] leading-tight text-ink">Recipes</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          Pick a recipe, add every ingredient to your list — matched to the stores you already shop at.
        </p>
      </div>
      <ShopTabs current="/shop/recipes" />

      <div className="mb-4 px-5">
        <AddRecipeButton screenshotAvailable={screenshotAvailable} />
      </div>

      {recipes.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={ChefHat}
            title="No recipes yet"
            description="Paste a link, upload a screenshot, or type one in."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5">
          {recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/shop/recipes/${recipe.id}`}
              className="flex gap-3 overflow-hidden rounded-(--radius-lg) border border-line bg-white shadow-(--shadow-card)"
            >
              <div className="relative h-24 w-24 shrink-0 bg-cream">
                {recipe.cover_image_url ? (
                  <Image
                    src={recipe.cover_image_url}
                    alt={recipe.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ChefHat className="h-7 w-7 text-muted2" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 py-3 pr-3.5">
                <div className="font-serif text-[15px] font-semibold">{recipe.name}</div>
                <div className="mt-0.5 text-[11.5px] text-muted">
                  {recipe.time_minutes ? `${recipe.time_minutes} min` : "—"} · {recipe.servings ?? "—"}
                </div>
                <div className="mt-1.5 text-[11px] font-semibold text-oak">
                  {recipe.ingredient_count} ingredients · {recipe.store_count} stores
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
