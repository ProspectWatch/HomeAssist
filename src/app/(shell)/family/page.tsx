import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getFamily } from "@/lib/data/family";
import { getPlannableRecipes } from "@/lib/data/meal-plan";
import { FamilyView } from "./family-view";

export default async function FamilyPage() {
  const householdId = await getCurrentHouseholdId();
  const [family, recipes] = await Promise.all([
    getFamily(householdId),
    getPlannableRecipes(householdId),
  ]);
  return <FamilyView family={family} recipes={recipes.map((r) => ({ id: r.id, name: r.name }))} />;
}
