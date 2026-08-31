import { NextResponse } from "next/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getHouseholdSearchProducts } from "@/lib/data/catalog";

/**
 * The household's own branded products, for the picker's search index.
 *
 * Separate from /api/catalog because that one is shared and cached for an
 * hour: this is one family's data and must never be served to another, so it
 * is resolved from the session on every request and explicitly not cached.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const householdId = await getCurrentHouseholdId();
  const products = await getHouseholdSearchProducts(householdId);
  return NextResponse.json(
    { products },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
