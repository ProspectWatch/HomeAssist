import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getHomeStats } from "@/lib/data/home";
import { getDeals } from "@/lib/data/deals";
import { getWatchItems } from "@/lib/data/watch";
import { getDepartmentsWithCounts } from "@/lib/data/departments";
import { getHomeShoppingPlan } from "@/lib/data/shopping-plan";
import { getInventoryCounts } from "@/lib/data/inventory";
import { HomeView } from "./home-view";

export default async function HomePage() {
  const householdId = await getCurrentHouseholdId();
  const [stats, deals, watching, departments, shoppingPlan, inventory] = await Promise.all([
    getHomeStats(householdId),
    getDeals(householdId),
    getWatchItems(householdId),
    getDepartmentsWithCounts(householdId),
    getHomeShoppingPlan(householdId),
    getInventoryCounts(householdId),
  ]);

  return (
    <HomeView stats={stats} deals={deals} watching={watching} departments={departments} shoppingPlan={shoppingPlan} inventory={inventory} />
  );
}
