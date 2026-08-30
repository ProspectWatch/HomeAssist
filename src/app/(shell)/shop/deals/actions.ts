"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";
import { runHouseholdScan } from "@/lib/data/retailer-scan";

export type ScanActionResult = ActionResult & {
  summary?: string;
  perRetailer?: { retailerName: string; ok: boolean; note: string }[];
};

/**
 * Manual "check prices now" (§13). Reports honestly per retailer: a blocked or
 * failing retailer is surfaced as unavailable, never as a store that was
 * successfully checked and simply had no deals.
 */
export async function runManualScan(): Promise<ScanActionResult> {
  return runHouseholdAction<ScanActionResult>(async (_supabase, householdId) => {
    const result = await runHouseholdScan(householdId);

    const perRetailer = result.outcomes.map((o) =>
      o.status === "COMPLETE"
        ? {
            retailerName: o.retailerName,
            ok: true,
            note: `${o.observations.length} price${o.observations.length === 1 ? "" : "s"} found`,
          }
        : { retailerName: o.retailerName, ok: false, note: `Scan unavailable — ${o.reason}` },
    );

    const okCount = perRetailer.filter((r) => r.ok).length;
    revalidatePath("/shop/deals");
    revalidatePath("/shop/list");
    revalidatePath("/home");

    return {
      ok: true,
      summary: `${okCount} / ${result.outcomes.length} retailers checked · ${result.observationsStored} price observations stored`,
      perRetailer,
    };
  });
}
