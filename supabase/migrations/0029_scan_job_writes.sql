-- The same hole 0019 closed on retailer_price_observations, still open one
-- table over. scan_jobs has a SELECT policy and nothing else, so every insert
-- from a member's session is denied by RLS, and runFlyerScan discards the
-- result of that insert -- so a scan that genuinely worked recorded nothing.
--
-- Live proof: 134 price observations written by real scans, 0 rows in
-- scan_jobs. "Last checked" on the Deals page reads this table, so it has been
-- claiming the prices were never fetched while showing prices those very scans
-- fetched. The cron path is unaffected -- it runs with the service role, which
-- bypasses RLS -- which is exactly why this stayed invisible.
--
-- Scoped to the household that owns the job, matching the read policy. A job
-- with a null household_id is retailer-wide ingestion output and stays
-- unwritable through a member's session on purpose.
drop policy if exists "members can record their household's scan jobs" on scan_jobs;
create policy "members can record their household's scan jobs"
  on scan_jobs for insert to authenticated
  with check (household_id is not null and is_household_member(household_id));
