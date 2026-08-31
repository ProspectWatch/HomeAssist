import { createAdminClient, hasAdminCredentials } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/auth/cron-auth";
import { runFlyerScan } from "@/lib/data/flyer-scan";

/**
 * Scheduled price scan.
 *
 * Flyers change weekly and website prices drift daily, so waiting for someone
 * to open the app and tap a button means the prices you see are as stale as
 * the last time you remembered. This runs the same scan on a schedule.
 *
 * Two things make it safe to let this act without a signed-in user:
 *
 *   1. It refuses to run unless the caller proves it is the scheduler. Vercel
 *      Cron sends `Authorization: Bearer $CRON_SECRET`; anything else gets a
 *      404, which does not even confirm the route exists.
 *   2. The service-role client it uses lives behind `server-only` and is
 *      constructed here, in a route handler. The key is never in a URL, never
 *      in a response, never in a log, and can never reach the browser.
 *
 * Households are scanned one at a time rather than in parallel: this app
 * serves one family, and being a polite guest at the flyer service matters
 * more than finishing a second sooner.
 */

// The scan spends up to ~38s searching before it stops asking for more, and
// runs once per household.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function unauthorized() {
  // Deliberately a 404, not a 401: an unauthenticated caller learns nothing
  // about whether this endpoint exists.
  return new Response("Not found", { status: 404 });
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  if (!hasAdminCredentials()) {
    return Response.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured; scheduled scanning is off." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("households").select("id, name");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const households = (data ?? []) as { id: string; name: string | null }[];
  const results: {
    household: string;
    status: string;
    searched?: number;
    stored?: number;
    reason?: string;
  }[] = [];

  for (const household of households) {
    try {
      const result = await runFlyerScan(household.id, supabase);
      results.push(
        result.status === "COMPLETE"
          ? {
              household: household.name ?? household.id,
              status: "COMPLETE",
              searched: result.targetsRequested,
              stored: result.stored,
            }
          : { household: household.name ?? household.id, status: "FAILED", reason: result.message },
      );
    } catch (cause) {
      // One household failing must not stop the others.
      results.push({
        household: household.name ?? household.id,
        status: "FAILED",
        reason: cause instanceof Error ? cause.message : "Unknown error",
      });
    }
  }

  return Response.json({ ok: true, households: results.length, results });
}
