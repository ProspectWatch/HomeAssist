import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getCatalogCategories, getRegularBuyIds } from "@/lib/data/catalog";
import { BrowseView } from "./browse-view";

export default async function BrowsePage() {
  const householdId = await getCurrentHouseholdId();
  const [categories, regularBuyIds] = await Promise.all([
    getCatalogCategories(),
    getRegularBuyIds(householdId),
  ]);
  return <BrowseView categories={categories} regularBuyIds={regularBuyIds} />;
}
