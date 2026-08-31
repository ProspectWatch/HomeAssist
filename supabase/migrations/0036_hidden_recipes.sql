-- Removing a starter recipe you don't want.
--
-- The four starter recipes have no household_id: the row belongs to every
-- household, and RLS rightly refuses to let one household delete it. But
-- "Sheet-Pan Salmon & Veg" sitting in a list of twenty recipes this family
-- actually cooks is clutter they cannot clear, and "you can't delete that"
-- is not an answer when the ask is to get it off their screen.
--
-- So removal is recorded per household rather than performed on the shared
-- row. It is exactly as effective for the person doing it -- the recipe is
-- gone from their recipes, their planner and the family screen -- without
-- reaching into anyone else's copy. It is also reversible, which a delete
-- would not be.

create table if not exists public.household_hidden_recipes (
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  hidden_at timestamptz not null default now(),
  hidden_by uuid references auth.users (id) on delete set null,
  primary key (household_id, recipe_id)
);

comment on table public.household_hidden_recipes is
  'Starter recipes a household has removed from its own view. The shared row is untouched.';

alter table public.household_hidden_recipes enable row level security;

drop policy if exists "hidden_recipes_select" on public.household_hidden_recipes;
create policy "hidden_recipes_select" on public.household_hidden_recipes
  for select using (is_household_member(household_id));

drop policy if exists "hidden_recipes_insert" on public.household_hidden_recipes;
create policy "hidden_recipes_insert" on public.household_hidden_recipes
  for insert with check (is_household_member(household_id));

drop policy if exists "hidden_recipes_delete" on public.household_hidden_recipes;
create policy "hidden_recipes_delete" on public.household_hidden_recipes
  for delete using (is_household_member(household_id));
