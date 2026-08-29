import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getGroceryItems } from "@/lib/data/grocery";
import { GroceryListView } from "./grocery-list-view";

export default async function GroceryListPage() {
  const householdId = await getCurrentHouseholdId();
  const items = await getGroceryItems(householdId);
  return <GroceryListView items={items} />;
}
