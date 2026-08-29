import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/data/recipes";
import { RecipeDetailView } from "./recipe-detail-view";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  return <RecipeDetailView recipe={recipe} />;
}
