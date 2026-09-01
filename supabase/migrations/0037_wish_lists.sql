-- Wish lists.
--
-- The kids want somewhere to put what they'd like for a birthday, for
-- Christmas, or what they're saving up for. That is not the household watch
-- list: a watch list is one shared record of things the house is waiting to
-- buy cheaply, whereas a wish list belongs to a person, has an occasion, and
-- is mostly read by somebody else deciding what to get them.
--
-- A note on secrecy, because the schema does not provide any and should not
-- pretend to: children are people in this household without logins, so every
-- wish list is visible to everyone using the app. "Got it" therefore means
-- "this has been bought", visible to all — not a secret the child cannot see.
-- Building a hidden flag would imply a privacy boundary that does not exist.

create table if not exists public.wish_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- Whose list. Null means the whole family's.
  person_id uuid references public.household_people (id) on delete cascade,
  title text not null,
  notes text,
  occasion text not null default 'ANYTIME',
  status text not null default 'WANTED',
  -- Wanted a lot, or just noted. Small scale on purpose: a 1-10 ranking is
  -- something nobody maintains.
  priority integer not null default 2,
  image_url text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint wish_list_items_occasion_check
    check (occasion in ('BIRTHDAY', 'CHRISTMAS', 'SAVING_UP', 'ANYTIME')),
  constraint wish_list_items_status_check
    check (status in ('WANTED', 'GOT_IT')),
  constraint wish_list_items_priority_check check (priority between 1 and 3)
);

-- Where it can be bought, and for how much. A list rather than columns on the
-- item because "compare them" is the point: the same bike at three shops is
-- three offers on one wish, not three wishes.
create table if not exists public.wish_list_offers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.wish_list_items (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  url text not null,
  site_name text,
  price_cents integer,
  currency text,
  image_url text,
  brand text,
  -- When the price was last read off the page. A price with no date is a
  -- rumour; this is what lets the screen say how old it is.
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint wish_list_offers_price_check check (price_cents is null or price_cents > 0)
);

create index if not exists wish_list_items_household_idx
  on public.wish_list_items (household_id, status);
create index if not exists wish_list_items_person_idx on public.wish_list_items (person_id);
create index if not exists wish_list_offers_item_idx on public.wish_list_offers (item_id);

alter table public.wish_list_items enable row level security;
alter table public.wish_list_offers enable row level security;

drop policy if exists "wish_items_select" on public.wish_list_items;
create policy "wish_items_select" on public.wish_list_items
  for select using (is_household_member(household_id));
drop policy if exists "wish_items_insert" on public.wish_list_items;
create policy "wish_items_insert" on public.wish_list_items
  for insert with check (is_household_member(household_id));
drop policy if exists "wish_items_update" on public.wish_list_items;
create policy "wish_items_update" on public.wish_list_items
  for update using (is_household_member(household_id))
  with check (is_household_member(household_id));
drop policy if exists "wish_items_delete" on public.wish_list_items;
create policy "wish_items_delete" on public.wish_list_items
  for delete using (is_household_member(household_id));

drop policy if exists "wish_offers_select" on public.wish_list_offers;
create policy "wish_offers_select" on public.wish_list_offers
  for select using (is_household_member(household_id));
drop policy if exists "wish_offers_insert" on public.wish_list_offers;
create policy "wish_offers_insert" on public.wish_list_offers
  for insert with check (is_household_member(household_id));
drop policy if exists "wish_offers_update" on public.wish_list_offers;
create policy "wish_offers_update" on public.wish_list_offers
  for update using (is_household_member(household_id))
  with check (is_household_member(household_id));
drop policy if exists "wish_offers_delete" on public.wish_list_offers;
create policy "wish_offers_delete" on public.wish_list_offers
  for delete using (is_household_member(household_id));
