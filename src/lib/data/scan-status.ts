import { createClient } from "@/lib/supabase/server";
import { formatLastChecked } from "@/lib/retailers/freshness";
import { RETAILER_NAME_BY_KEY, SUPPORTED_RETAILER_KEYS } from "@/lib/retailers/registry";

export type RetailerScanStatus = {
  retailerName: string;
  /** NEVER_RUN until a scan has actually been attempted for this retailer. */
  state: "OK" | "UNAVAILABLE" | "NEVER_RUN";
  lastCheckedLabel: string | null;
  /** Present only when the last attempt failed — shown instead of zero prices. */
  failureNote: string | null;
};

export type ScanStatusSummary = {
  retailers: RetailerScanStatus[];
  checkedCount: number;
  totalCount: number;
  lastCheckedLabel: string | null;
};

/**
 * Truthful scan status for the UI (§13).
 *
 * A retailer that has never been scanned, or whose last scan failed, is
 * reported as such — never as a successful check that happened to find
 * nothing. "X / Y retailers checked" counts only genuine successes.
 */
export async function getScanStatus(householdId: string | null): Promise<ScanStatusSummary> {
  const total = SUPPORTED_RETAILER_KEYS.length;
  const empty: ScanStatusSummary = {
    retailers: SUPPORTED_RETAILER_KEYS.map((key) => ({
      retailerName: RETAILER_NAME_BY_KEY[key],
      state: "NEVER_RUN",
      lastCheckedLabel: null,
      failureNote: null,
    })),
    checkedCount: 0,
    totalCount: total,
    lastCheckedLabel: null,
  };
  if (!householdId) return empty;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("scan_jobs")
      .select("status, error, finished_at, source, retailer:retailers(name)")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(50);

    type Row = {
      status: string;
      error: string | null;
      finished_at: string | null;
      source: string;
      retailer: { name: string } | null;
    };
    const rows = (data ?? []) as unknown as Row[];
    if (rows.length === 0) return empty;

    const latestByRetailer = new Map<string, Row>();
    for (const row of rows) {
      const name = row.retailer?.name;
      if (!name || latestByRetailer.has(name)) continue; // newest first
      latestByRetailer.set(name, row);
    }

    const now = new Date();
    const retailers = SUPPORTED_RETAILER_KEYS.map((key) => {
      const name = RETAILER_NAME_BY_KEY[key];
      const row = latestByRetailer.get(name);
      if (!row) {
        return { retailerName: name, state: "NEVER_RUN" as const, lastCheckedLabel: null, failureNote: null };
      }
      const succeeded = row.status === "COMPLETE" || row.status === "succeeded";
      return {
        retailerName: name,
        state: succeeded ? ("OK" as const) : ("UNAVAILABLE" as const),
        lastCheckedLabel: row.finished_at ? formatLastChecked(row.finished_at, now) : null,
        failureNote: succeeded ? null : "Scan unavailable",
      };
    });

    const successes = retailers.filter((r) => r.state === "OK");
    const mostRecent = rows.find((r) => (r.status === "COMPLETE" || r.status === "succeeded") && r.finished_at);

    return {
      retailers,
      checkedCount: successes.length,
      totalCount: total,
      lastCheckedLabel: mostRecent?.finished_at ? formatLastChecked(mostRecent.finished_at, now) : null,
    };
  } catch {
    return empty;
  }
}
