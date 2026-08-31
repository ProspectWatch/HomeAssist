import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getPlannableRecipes, getWeekPlan } from "@/lib/data/meal-plan";
import { getHouseholdPeople } from "@/lib/data/people";
import { toISODate, weekStart } from "@/lib/meals/week";
import { PlanView } from "./plan-view";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const householdId = await getCurrentHouseholdId();
  const params = await searchParams;

  // The week is in the URL so it survives a refresh and can be shared between
  // two phones looking at the same plan.
  const today = toISODate(new Date());
  const start = weekStart(params.week ?? today);

  const [plan, recipes, people] = await Promise.all([
    getWeekPlan(householdId, start),
    getPlannableRecipes(householdId),
    getHouseholdPeople(householdId),
  ]);

  return (
    <PlanView
      weekStartIso={start}
      todayIso={today}
      meals={plan.meals}
      recipes={recipes}
      people={people}
    />
  );
}
