import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getDeals, getLastScanTime } from "@/lib/data/deals";
import { DealsView } from "./deals-view";

export default async function DealsPage() {
  const householdId = await getCurrentHouseholdId();
  const [deals, lastScanTime] = await Promise.all([getDeals(householdId), getLastScanTime()]);
  return <DealsView deals={deals} lastScanTime={lastScanTime} />;
}
