import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getWishLists } from "@/lib/data/wish-lists";
import { getHouseholdPeople } from "@/lib/data/people";
import { WishView } from "./wish-view";

export default async function WishPage() {
  const householdId = await getCurrentHouseholdId();
  const [lists, people] = await Promise.all([
    getWishLists(householdId),
    getHouseholdPeople(householdId),
  ]);
  return <WishView lists={lists} people={people} />;
}
