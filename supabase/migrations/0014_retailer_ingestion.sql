-- Phase 3A: the retailer ingestion layer.
--
-- Strict separation of responsibilities, mirroring the phase brief:
--   retailer layer  -> "what product is this, and what price did we observe?"
--   Phase 2C engine -> "should this household buy it, and where?"
-- Nothing in these tables encodes a purchase decision.
--
-- Every row here must be traceable to a real observation (retailer, store,
-- source URL, timestamp). There is deliberately no default price, no seeded
-- observation and no placeholder store: an empty table means "we have not
-- observed anything yet", which is the truth until a legitimate data source
-- is available.

-- A physical store, as distinct from the retailer brand. Only ever populated
-- with verified real locations; latitude/longitude/distance/drive time stay
-- null until they come from a real source rather than being estimated.
create table if not exists retailer_locations (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references retailers (id) on delete cascade,
  external_location_id text,
  name text not null,
  address text,
  city text,
  province text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  -- Never estimated. Populated only from a real routing/geocoding source.
  distance_km double precision,
  drive_time_minutes integer,
  active boolean not null default true,
  last_verified_at timestamptz,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer_id, external_location_id)
);

create index if not exists retailer_locations_retailer_idx on retailer_locations (retailer_id) where active;

-- Append-only price history. Nothing here is ever overwritten: a new scan
-- inserts a new observation, so "all-time low" and target-price reasoning in
-- the Phase 2C engine have real history to stand on. The unique index
-- deduplicates only an identical re-observation of the same price at the same
-- store within the same day, which is a repeat sighting rather than new
-- information.
create table if not exists retailer_price_observations (
  id uuid primary key default gen_random_uuid(),
  catalog_product_id text references catalog_products (id) on delete set null,
  retailer_id uuid not null references retailers (id) on delete cascade,
  retailer_location_id uuid references retailer_locations (id) on delete set null,
  external_product_id text,

  observed_price_cents integer not null,
  regular_price_cents integer,
  unit_price_text text,

  package_size text,
  unit text,

  promotion_text text,
  valid_from date,
  valid_until date,

  availability text,

  -- Provenance (§19): required for every observation.
  source_url text,
  source_type text not null default 'adapter',

  match_confidence numeric(4, 3),
  match_method text,
  match_status text not null default 'MATCHED'
    check (match_status in ('MATCHED', 'LIKELY_MATCH', 'REVIEW_REQUIRED', 'UNMATCHED')),

  raw_name text,
  raw_brand text,
  raw_payload jsonb,

  observed_at timestamptz not null default now(),
  -- Immutable UTC calendar day, so the dedupe index below can be expression-free.
  observed_on date generated always as ((observed_at at time zone 'UTC')::date) stored,
  created_at timestamptz not null default now()
);

create index if not exists rpo_catalog_observed_idx
  on retailer_price_observations (catalog_product_id, observed_at desc);
create index if not exists rpo_retailer_observed_idx
  on retailer_price_observations (retailer_id, observed_at desc);
create index if not exists rpo_review_idx
  on retailer_price_observations (match_status) where match_status in ('REVIEW_REQUIRED', 'UNMATCHED');

create unique index if not exists rpo_dedupe_same_day_same_price
  on retailer_price_observations (
    retailer_id,
    coalesce(retailer_location_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(external_product_id, ''),
    observed_price_cents,
    observed_on
  );

-- Catalogue and observations are household-independent reference data, so
-- reads are open to signed-in members; writes stay server-side.
alter table retailer_locations enable row level security;
alter table retailer_price_observations enable row level security;

drop policy if exists "signed-in users can read retailer locations" on retailer_locations;
create policy "signed-in users can read retailer locations"
  on retailer_locations for select to authenticated using (true);

drop policy if exists "signed-in users can read price observations" on retailer_price_observations;
create policy "signed-in users can read price observations"
  on retailer_price_observations for select to authenticated using (true);

-- Extend the existing scan_jobs foundation rather than replacing it. The
-- original status vocabulary is widened to the Phase 3A set; 'partial' matters
-- because one retailer failing must not be reported as a clean success (§18).
alter table scan_jobs
  add column if not exists household_id uuid references households (id) on delete cascade,
  add column if not exists retailer_location_id uuid references retailer_locations (id) on delete set null,
  add column if not exists targets_requested integer not null default 0,
  add column if not exists targets_matched integer not null default 0,
  add column if not exists prices_found integer not null default 0,
  add column if not exists source text not null default 'adapter';

alter table scan_jobs drop constraint if exists scan_jobs_status_check;
alter table scan_jobs
  add constraint scan_jobs_status_check
  check (status in ('queued', 'running', 'succeeded', 'failed', 'QUEUED', 'RUNNING', 'COMPLETE', 'PARTIAL', 'FAILED'));

create index if not exists scan_jobs_household_idx on scan_jobs (household_id, created_at desc);

drop policy if exists "members can read their household's scan jobs" on scan_jobs;
create policy "members can read their household's scan jobs"
  on scan_jobs for select to authenticated
  using (household_id is null or is_household_member(household_id));
