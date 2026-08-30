-- Phase 2E: household inventory state — "what do we actually have right now?"
--
-- Deliberately its OWN table, not a column on household_product_preferences.
-- Phase 2D established regular_buy as a preference-layer intent ("we keep
-- this"); inventory is a different, faster-moving fact ("we're out of it").
-- Keeping them apart preserves the separation the household model relies on:
--   catalog_products              generic dictionary
--   household_product_preferences what we keep + how we want it bought
--   household_inventory_state     what we have right now   <- this table
--   grocery_items                 what we still need to buy
--   watch_items                   what we're waiting on a price for
--
-- NOTHING is seeded here. A regular buy with no row is UNKNOWN, which is the
-- honest state until somebody actually walks the kitchen and says otherwise.
-- That is why status has no backfill and why the app treats "no row" as
-- UNKNOWN rather than defaulting 146 products to IN_STOCK.

create table if not exists household_inventory_state (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  catalog_product_id text not null references catalog_products(id) on delete cascade,
  status text not null default 'UNKNOWN' check (status in ('UNKNOWN', 'IN_STOCK', 'LOW', 'OUT')),
  -- Optional and free-text on purpose: a household walking its pantry says
  -- "low", not "1.5 kg". Never required.
  quantity text,
  note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, catalog_product_id)
);

create index if not exists household_inventory_state_household_status_idx
  on household_inventory_state (household_id, status);

alter table household_inventory_state enable row level security;

drop policy if exists "members can manage their household's inventory" on household_inventory_state;
create policy "members can manage their household's inventory"
  on household_inventory_state
  for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Where a household need came from. VOICE is reserved for a future Alexa
-- integration and is intentionally a valid value now so that path will go
-- through the same product matching and duplicate protection as every other
-- source rather than around it. No voice code exists yet.
alter table grocery_items
  add column if not exists source text not null default 'MANUAL',
  add column if not exists note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'grocery_items_source_check'
  ) then
    alter table grocery_items
      add constraint grocery_items_source_check
      check (source in ('MANUAL', 'PANTRY', 'RECIPE', 'VOICE', 'RECEIPT', 'AUTOMATION'));
  end if;
end
$$;

-- One active (unchecked) row per catalogue product per household: the
-- database-level backstop for duplicate protection, so "Eggs" can never be
-- added twice even if two people tap OUT at the same moment. Custom
-- name-only items have a null catalog_product_id and are unaffected.
create unique index if not exists grocery_items_one_active_per_catalog_product
  on grocery_items (household_id, catalog_product_id)
  where catalog_product_id is not null and not checked;
