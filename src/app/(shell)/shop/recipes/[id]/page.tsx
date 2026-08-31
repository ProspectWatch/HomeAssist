import { notFound } from "next/navigation";
import { getRecipeKitchen } from "@/lib/data/recipes";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { RecipeDetailView } from "./recipe-detail-view";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const householdId = await getCurrentHouseholdId();
  const kitchen = await getRecipeKitchen(id, householdId);
  if (!kitchen) notFound();
  return <RecipeDetailView kitchen={kitchen} />;
}
