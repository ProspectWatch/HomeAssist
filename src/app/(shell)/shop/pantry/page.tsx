import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getRegularBuys } from "@/lib/data/pantry";
import { PantryView } from "./pantry-view";

export default async function PantryPage() {
  const householdId = await getCurrentHouseholdId();
  const items = await getRegularBuys(householdId);
  return <PantryView items={items} />;
}
