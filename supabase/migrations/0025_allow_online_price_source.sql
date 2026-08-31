-- Website prices had nowhere to go.
--
-- source_type carries a check constraint listing the sources an observation
-- may come from. ONLINE was added in application code when website-price
-- ingestion shipped, but never here — so every scheduled and manual scan
-- failed at the insert with a constraint violation.
--
-- It failed loudly, but it failed WHOLE: flyer rows and website rows are
-- written in a single statement, so a handful of invalid ONLINE rows threw
-- away the valid FLYER ones alongside them. The visible symptom was a Deals
-- page that stayed empty after a scan that had actually worked.
--
-- src/lib/retailers/source-types.ts mirrors this list, and a test asserts the
-- ingestion builders only emit values that appear in it, so the next
-- mismatch is a failing test rather than an empty page.
alter table retailer_price_observations
  drop constraint if exists retailer_price_observations_source_type_check;

alter table retailer_price_observations
  add constraint retailer_price_observations_source_type_check
  check (
    source_type in (
      'RECEIPT',         -- a price this household actually paid
      'MANUAL',          -- a shelf price someone typed in
      'FLYER',           -- an advertised weekly-flyer price
      'ONLINE',          -- a retailer's current website price
      'RETAILER_LIVE',   -- a live shelf price, if a retailer ever permits it
      'OTHER_VERIFIED',
      'adapter'
    )
    or source_type like 'adapter:%'
  );
