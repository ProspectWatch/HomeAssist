-- Phase 3B: receipts as the first legitimate real-world price source.
--
-- Extends the EXISTING receipts / receipt_items tables from 0001 rather than
-- creating a parallel receipt model, and feeds the EXISTING Phase 3A
-- retailer_price_observations rather than a second price table.
--
-- The core rule encoded here: OCR output is never household truth. A receipt
-- only becomes purchase history and price observations after a human confirms
-- it, which is why `status` exists and why nothing downstream reads a receipt
-- that isn't VERIFIED.

alter table receipts
  add column if not exists status text not null default 'UPLOADED'
    check (status in ('UPLOADED', 'PROCESSING', 'REVIEW_REQUIRED', 'VERIFIED', 'FAILED')),
  add column if not exists retailer_location_id uuid references retailer_locations (id) on delete set null,
  add column if not exists storage_path text,
  -- SHA-256 of the uploaded file: the strongest duplicate signal (§22).
  add column if not exists document_hash text,
  add column if not exists purchased_time text,
  add column if not exists subtotal_cents integer,
  add column if not exists tax_cents integer,
  add column if not exists transaction_ref text,
  -- Raw extractor text, retained for user review and debugging (§4).
  add column if not exists raw_text text,
  add column if not exists extractor text,
  add column if not exists extraction_confidence numeric(4, 3),
  add column if not exists extraction_error text,
  add column if not exists processed_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users (id) on delete set null;

-- total_cents was NOT NULL in 0001, but an upload has no total until it has
-- been read. Allow null so a receipt can exist in UPLOADED/FAILED state
-- without inventing a number.
alter table receipts alter column total_cents drop not null;
alter table receipts alter column purchased_at drop not null;

create index if not exists receipts_household_status_idx on receipts (household_id, status, created_at desc);
create unique index if not exists receipts_household_document_hash_idx
  on receipts (household_id, document_hash) where document_hash is not null;

-- Receipt lines gain catalogue identity and the extraction detail needed to
-- review them. price_cents (0001) stays as the line total for compatibility.
alter table receipt_items
  add column if not exists catalog_product_id text references catalog_products (id) on delete set null,
  add column if not exists raw_description text,
  -- Null, never 1-by-default: pretending an unknown quantity is 1 would
  -- distort unit economics (§9).
  add column if not exists quantity numeric(10, 3),
  add column if not exists unit_price_cents integer,
  add column if not exists line_total_cents integer,
  add column if not exists discount_cents integer,
  add column if not exists line_type text not null default 'ITEM'
    check (line_type in ('ITEM', 'DISCOUNT', 'TAX', 'SUBTOTAL', 'TOTAL', 'UNKNOWN')),
  add column if not exists match_status text not null default 'UNMATCHED'
    check (match_status in ('MATCHED', 'LIKELY_MATCH', 'REVIEW_REQUIRED', 'UNMATCHED', 'IGNORED')),
  add column if not exists match_confidence numeric(4, 3),
  add column if not exists match_method text,
  add column if not exists confirmed_by_user boolean not null default false,
  add column if not exists sort_order integer not null default 0;

alter table receipt_items alter column price_cents drop not null;
alter table receipt_items alter column name drop not null;

create index if not exists receipt_items_receipt_idx on receipt_items (receipt_id, sort_order);

-- Learned, retailer-scoped abbreviation mappings (§8). Deliberately keyed by
-- retailer: "CNSTGA BRN FR RNG" meaning Conestoga eggs at Food Basics says
-- nothing about what that string means at Costco.
create table if not exists retailer_product_aliases (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references retailers (id) on delete cascade,
  -- Normalized form of the raw receipt text, for lookup.
  raw_description text not null,
  catalog_product_id text not null references catalog_products (id) on delete cascade,
  confidence numeric(4, 3) not null default 1.0,
  confirmed_by_user boolean not null default true,
  times_seen integer not null default 1,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (retailer_id, raw_description)
);

create index if not exists retailer_product_aliases_lookup_idx
  on retailer_product_aliases (retailer_id, raw_description);

-- Verified household purchase history (§9). Distinct from price observations:
-- this is "we bought this", the observation is "this cost that".
create table if not exists household_purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  receipt_id uuid references receipts (id) on delete cascade,
  receipt_item_id uuid references receipt_items (id) on delete set null,
  catalog_product_id text references catalog_products (id) on delete set null,
  retailer_id uuid references retailers (id) on delete set null,
  retailer_location_id uuid references retailer_locations (id) on delete set null,
  purchase_date date not null,
  -- Null when the receipt didn't state it. Never defaulted to 1.
  quantity numeric(10, 3),
  unit_price_cents integer,
  line_total_cents integer not null,
  discount_cents integer,
  created_at timestamptz not null default now()
);

create index if not exists household_purchases_product_idx
  on household_purchases (household_id, catalog_product_id, purchase_date desc);

alter table retailer_product_aliases enable row level security;
alter table household_purchases enable row level security;

-- Aliases are reference data learned from confirmations; readable by signed-in
-- members, writable through server actions under the member's own session.
drop policy if exists "signed-in users can read retailer aliases" on retailer_product_aliases;
create policy "signed-in users can read retailer aliases"
  on retailer_product_aliases for select to authenticated using (true);
drop policy if exists "signed-in users can write retailer aliases" on retailer_product_aliases;
create policy "signed-in users can write retailer aliases"
  on retailer_product_aliases for all to authenticated using (true) with check (true);

drop policy if exists "members can manage their household's purchases" on household_purchases;
create policy "members can manage their household's purchases"
  on household_purchases for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Price source vocabulary (§16). RECEIPT is a price actually PAID; a live
-- retailer price is what is currently advertised. Collapsing them would let an
-- old receipt masquerade as today's shelf price.
alter table retailer_price_observations drop constraint if exists retailer_price_observations_source_type_check;
alter table retailer_price_observations
  add constraint retailer_price_observations_source_type_check
  check (source_type in ('RECEIPT', 'MANUAL', 'RETAILER_LIVE', 'FLYER', 'OTHER_VERIFIED', 'adapter')
         or source_type like 'adapter:%');

alter table retailer_price_observations
  add column if not exists receipt_id uuid references receipts (id) on delete set null,
  add column if not exists household_id uuid references households (id) on delete cascade;

create index if not exists rpo_receipt_idx on retailer_price_observations (receipt_id)
  where receipt_id is not null;

-- Receipt images are private household documents (§19, §20): a private bucket,
-- with access scoped to members of the owning household by path prefix.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "household members read their receipts" on storage.objects;
create policy "household members read their receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "household members upload their receipts" on storage.objects;
create policy "household members upload their receipts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "household members delete their receipts" on storage.objects;
create policy "household members delete their receipts"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  );
