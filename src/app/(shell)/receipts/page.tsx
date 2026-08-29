import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getReceipts } from "@/lib/data/receipts";
import { ReceiptsView } from "./receipts-view";

export default async function ReceiptsPage() {
  const householdId = await getCurrentHouseholdId();
  const receipts = await getReceipts(householdId);
  return <ReceiptsView receipts={receipts} />;
}
