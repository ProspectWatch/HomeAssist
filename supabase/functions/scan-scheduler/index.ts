// Scan scheduler — infrastructure stub, not a scraper.
//
// This function is the intended entry point for scheduled product scanning
// (see docs/ARCHITECTURE.md § Scheduled scanning). Today it only proves the
// pipeline wiring: it opens a scan_jobs row, does no retailer fetching at
// all, and closes the row out. Do not add scraping logic here until a
// retailer integration has been explicitly scoped and approved — this stub
// exists so the cron → function → DB path can be tested end-to-end first.
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("SCAN_SCHEDULER_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: job, error: insertError } = await supabase
    .from("scan_jobs")
    .insert({ status: "running", trigger: "cron", started_at: new Date().toISOString() })
    .select()
    .single();

  if (insertError) {
    return Response.json({ ok: false, error: insertError.message }, { status: 500 });
  }

  // Intentionally no retailer fetch/scrape here yet — see header comment.

  const { error: updateError } = await supabase
    .from("scan_jobs")
    .update({
      status: "succeeded",
      finished_at: new Date().toISOString(),
      products_scanned: 0,
    })
    .eq("id", job.id);

  if (updateError) {
    return Response.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true, jobId: job.id });
});
