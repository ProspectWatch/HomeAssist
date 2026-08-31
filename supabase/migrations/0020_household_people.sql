-- The people in the household, and attributing purchases to them.
--
-- Two person-shaped things already existed and neither answers "who is in this
-- family": household_members is app LOGINS (an adult with a phone), and
-- athletes is a sports-only list. A child has no login and may play no sport,
-- but a good chunk of the shopping is for them.
--
-- household_people is the general answer. A person may optionally be linked to
-- a login (user_id) and may optionally be an athlete; neither is required.

create table if not exists household_people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  -- Drives wording and defaults, not permissions. A child is someone things
  -- are bought FOR; it never implies an account.
  is_child boolean not null default false,
  -- Set when this person also signs in. Null for children and for adults who
  -- simply don't use the app.
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create index if not exists household_people_household_idx on household_people (household_id, name);
create unique index if not exists household_people_user_idx
  on household_people (household_id, user_id) where user_id is not null;

alter table household_people enable row level security;

drop policy if exists "members manage their household's people" on household_people;
create policy "members manage their household's people"
  on household_people for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Sports stays its own feature; an athlete is now a facet of a person rather
-- than a second, parallel list of names. Nullable, and the athletes table is
-- empty today, so nothing needs migrating.
alter table athletes add column if not exists person_id uuid references household_people (id) on delete set null;

-- Attribution. Nullable everywhere: most of a grocery shop is for the house,
-- and forcing a person onto every line would be worse than leaving it blank.
alter table receipt_items add column if not exists person_id uuid references household_people (id) on delete set null;
alter table household_purchases add column if not exists person_id uuid references household_people (id) on delete set null;
alter table grocery_items add column if not exists person_id uuid references household_people (id) on delete set null;

create index if not exists household_purchases_person_idx
  on household_purchases (household_id, person_id, purchase_date desc) where person_id is not null;
