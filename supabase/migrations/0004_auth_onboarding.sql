-- Phase 2A — real auth + household onboarding.
--
-- Adds what's needed to let a signed-in user create (or join) a real
-- household, and extends household_settings with the full address +
-- an ordered store-preference list the design/task calls for. Extends the
-- existing schema only — 0001-0003 are untouched.

-- ---------------------------------------------------------------------------
-- Households: allow a signed-in user to create one, and to join an existing
-- one via a short join code (no invite system yet — a family member shares
-- the code out of band).
-- ---------------------------------------------------------------------------

alter table households
  add column join_code text unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

create policy "authenticated users can create a household"
  on households for insert
  to authenticated
  with check (true);

-- Looks up a household by its join code without exposing the households
-- table to non-members. Returns only what the join UI needs.
create function household_by_join_code(code text)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
stable
as $$
  select id, name from households where join_code = code;
$$;

-- A user may always insert themselves as a 'member' (used by the join
-- flow, once they know a household's id via household_by_join_code), and
-- may insert themselves as 'owner' only when the household has no members
-- yet — i.e. they are the one creating it.
create policy "users can join a household or become owner of a new one"
  on household_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      role = 'member'
      or (
        role = 'owner'
        and not exists (
          select 1 from household_members hm2
          where hm2.household_id = household_members.household_id
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Household settings: full address + ordered store preferences, replacing
-- the single preferred_retailer_id (no live data yet to migrate).
-- ---------------------------------------------------------------------------

alter table household_settings
  drop column preferred_retailer_id,
  add column province text,
  add column country text not null default 'Canada',
  add column preferred_retailer_ids uuid[] not null default '{}'::uuid[];
