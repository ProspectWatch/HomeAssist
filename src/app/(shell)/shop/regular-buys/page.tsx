import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getRegularBuyList } from "@/lib/data/catalog";
import { RegularBuysView } from "./regular-buys-view";

export default async function RegularBuysPage() {
  const householdId = await getCurrentHouseholdId();
  const buys = await getRegularBuyList(householdId);
  return <RegularBuysView buys={buys} />;
}
