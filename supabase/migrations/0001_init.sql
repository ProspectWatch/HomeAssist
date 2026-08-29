-- Brown Family Home — Phase 1 schema.
--
-- Scope: household/auth model, rooms, a manually-curated product catalog,
-- and watch list. Also lays down the *structure* for price history and
-- scheduled scanning so the pipeline has somewhere to write to — but no
-- retailer scraping is implemented yet, and no rows are ever seeded into
-- price_snapshots. Every price/inventory value in this app must come from
-- a real scan or a user's own manual entry, never from migration seed data.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Households
-- ---------------------------------------------------------------------------

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index household_members_user_id_idx on household_members (user_id);

-- True if the current JWT belongs to a member of the given household.
-- security definer so RLS policies can call it without re-triggering RLS
-- on household_members and recursing.
create function is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

alter table households enable row level security;
alter table household_members enable row level security;

create policy "members can read their household"
  on households for select
  using (is_household_member(id));

create policy "members can read their membership rows"
  on household_members for select
  using (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------

create table rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index rooms_household_id_idx on rooms (household_id);

alter table rooms enable row level security;

create policy "members can manage their household's rooms"
  on rooms for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Retailers — reference data for the future scan pipeline.
-- Empty until retailers are deliberately onboarded; scan_enabled stays
-- false until that retailer's scanner ships.
-- ---------------------------------------------------------------------------

create table retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  domain text not null unique,
  logo_url text,
  scan_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table retailers enable row level security;

create policy "authenticated users can read retailers"
  on retailers for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Products — a household's own catalog of items it cares about.
-- Phase 1 entries are added manually (paste a URL/title); nothing here is
-- populated by scraping yet.
-- ---------------------------------------------------------------------------

create table products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  retailer_id uuid references retailers (id) on delete set null,
  title text not null,
  brand text,
  product_url text,
  image_url text,
  external_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index products_household_id_idx on products (household_id);
create index products_retailer_id_idx on products (retailer_id);

alter table products enable row level security;

create policy "members can manage their household's products"
  on products for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Watch list
-- ---------------------------------------------------------------------------

create table watch_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  room_id uuid references rooms (id) on delete set null,
  target_price_cents integer check (target_price_cents is null or target_price_cents >= 0),
  status text not null default 'watching' check (status in ('watching', 'paused', 'archived')),
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (household_id, product_id)
);

create index watch_items_household_id_idx on watch_items (household_id);
create index watch_items_room_id_idx on watch_items (room_id);

alter table watch_items enable row level security;

create policy "members can manage their household's watch items"
  on watch_items for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Price snapshots — structure for the future scan pipeline.
-- No seed data. Rows are only ever written by: (a) the scan pipeline once
-- built, or (b) a user manually logging a price they observed themselves.
-- ---------------------------------------------------------------------------

create table price_snapshots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  retailer_id uuid references retailers (id) on delete set null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD',
  in_stock boolean,
  source text not null default 'scan' check (source in ('scan', 'manual')),
  captured_at timestamptz not null default now()
);

create index price_snapshots_product_id_idx on price_snapshots (product_id, captured_at desc);

alter table price_snapshots enable row level security;

create policy "members can read price history for their products"
  on price_snapshots for select
  using (
    exists (
      select 1 from products
      where products.id = price_snapshots.product_id
        and is_household_member(products.household_id)
    )
  );

-- Manual entries: a member may log a price they personally observed.
create policy "members can manually log a price for their products"
  on price_snapshots for insert
  with check (
    source = 'manual'
    and exists (
      select 1 from products
      where products.id = price_snapshots.product_id
        and is_household_member(products.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Scan jobs — scheduling infrastructure only. No scraping logic lives here;
-- see docs/ARCHITECTURE.md for how this table is intended to be driven by
-- pg_cron + a Supabase Edge Function once retailer scanning is built.
-- Service-role only: no client-facing policy is defined, so only the
-- service role (which bypasses RLS) can read or write these rows.
-- ---------------------------------------------------------------------------

create table scan_jobs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references retailers (id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  trigger text not null default 'cron' check (trigger in ('cron', 'manual')),
  started_at timestamptz,
  finished_at timestamptz,
  products_scanned integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

alter table scan_jobs enable row level security;
