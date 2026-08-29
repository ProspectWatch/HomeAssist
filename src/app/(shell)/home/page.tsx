import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getHomeStats } from "@/lib/data/home";
import { getDeals } from "@/lib/data/deals";
import { getWatchItems } from "@/lib/data/watch";
import { getDepartmentsWithCounts } from "@/lib/data/departments";
import { HomeView } from "./home-view";

export default async function HomePage() {
  const householdId = await getCurrentHouseholdId();
  const [stats, deals, watching, departments] = await Promise.all([
    getHomeStats(householdId),
    getDeals(householdId),
    getWatchItems(householdId),
    getDepartmentsWithCounts(householdId),
  ]);

  return <HomeView stats={stats} deals={deals} watching={watching} departments={departments} />;
}
