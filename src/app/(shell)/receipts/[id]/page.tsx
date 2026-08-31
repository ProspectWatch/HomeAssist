import { notFound } from "next/navigation";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getReceiptDetail } from "@/lib/data/receipts";
import { getHouseholdPeople } from "@/lib/data/people";
import { getReceiptPriceNotes } from "@/lib/data/receipt-prices";
import { ReceiptReviewView } from "./receipt-review-view";

export default async function ReceiptReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const householdId = await getCurrentHouseholdId();
  const [receipt, people] = await Promise.all([
    getReceiptDetail(householdId, id),
    getHouseholdPeople(householdId),
  ]);
  if (!receipt) notFound();

  const priceNotes = await getReceiptPriceNotes(householdId, receipt);
  return <ReceiptReviewView receipt={receipt} people={people} priceNotes={priceNotes} />;
}
