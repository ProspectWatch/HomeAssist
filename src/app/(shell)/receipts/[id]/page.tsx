import { notFound } from "next/navigation";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getReceiptDetail } from "@/lib/data/receipts";
import { ReceiptReviewView } from "./receipt-review-view";

export default async function ReceiptReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const householdId = await getCurrentHouseholdId();
  const receipt = await getReceiptDetail(householdId, id);
  if (!receipt) notFound();
  return <ReceiptReviewView receipt={receipt} />;
}
