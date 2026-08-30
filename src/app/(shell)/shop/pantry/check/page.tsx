import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getRegularBuys } from "@/lib/data/pantry";
import { PantryCheckView } from "./pantry-check-view";

export default async function PantryCheckPage() {
  const householdId = await getCurrentHouseholdId();
  const items = await getRegularBuys(householdId);
  return <PantryCheckView items={items} />;
}
