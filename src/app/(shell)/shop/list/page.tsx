import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getGroceryItems } from "@/lib/data/grocery";
import { getStores } from "@/lib/data/stores";
import { GroceryListView } from "./grocery-list-view";

export default async function GroceryListPage() {
  const householdId = await getCurrentHouseholdId();
  const [items, stores] = await Promise.all([getGroceryItems(householdId), getStores()]);
  return <GroceryListView items={items} stores={stores} />;
}
