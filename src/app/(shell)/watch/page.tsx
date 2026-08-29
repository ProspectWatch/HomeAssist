import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getWatchItems, getWatchSpecs } from "@/lib/data/watch";
import { WatchView } from "./watch-view";

export default async function WatchPage() {
  const householdId = await getCurrentHouseholdId();
  const [items, specs] = await Promise.all([getWatchItems(householdId), getWatchSpecs(householdId)]);
  return <WatchView items={items} specs={specs} />;
}
