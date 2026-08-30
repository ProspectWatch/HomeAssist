import { NextResponse } from "next/server";
import { getCatalogSearchIndex } from "@/lib/data/catalog";

// Backs the client-side ProductPicker cache (step 11): the whole active
// catalogue is a few hundred rows, small enough to fetch once per session
// and filter instantly in the browser instead of round-tripping per
// keystroke. Revalidated hourly — the catalogue only changes via re-import.
export const revalidate = 3600;

export async function GET() {
  const products = await getCatalogSearchIndex();
  return NextResponse.json({ products });
}
