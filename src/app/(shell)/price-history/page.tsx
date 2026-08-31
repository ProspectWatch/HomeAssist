import { TopBar } from "@/components/nav/top-bar";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getPriceBookRows } from "@/lib/data/price-book";
import { PriceBookView } from "./price-book-view";

export default async function PriceHistoryPage() {
  const householdId = await getCurrentHouseholdId();
  const rows = await getPriceBookRows(householdId);

  return (
    <div className="pb-8">
      <TopBar title="Price Book" subtitle="What you actually pay, and where" />
      <PriceBookView rows={rows} />
    </div>
  );
}
