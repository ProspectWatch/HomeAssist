import { NextResponse } from "next/server";
import { getCatalogSearchIndex } from "@/lib/data/catalog";

// Backs the client-side ProductPicker cache (step 11): the whole active
// catalogue is fetched once per session and filtered instantly in the browser
// instead of round-tripping per keystroke. It is ~1,700 rows now, so
// getCatalogSearchIndex() pages past PostgREST's row cap rather than silently
// returning the first page. Revalidated hourly — the catalogue only changes
// via a seed or a household adding a product from a receipt.
export const revalidate = 3600;

export async function GET() {
  const products = await getCatalogSearchIndex();
  return NextResponse.json({ products });
}
