-- Meal planning: who eats what, and what that means for the shopping list.
--
-- Four things the household asked for, and one they did not but which the rest
-- of it depends on being right.
--
--   * people gain the facts a plan has to respect -- allergies and dislikes;
--   * recipes can belong to a household, carry which meals they suit, and be
--     found by how long they take (hockey season is the constraint);
--   * a person can love or refuse a specific recipe;
--   * a week is planned per slot, and an entry is either the whole household's
--     (dinner) or one person's (a school lunch). Both, because both is how a
--     family actually eats.
--
-- The one they did not ask for: recipes were readable by every authenticated
-- user, which was fine while they were a shared starter set and stops being
-- fine the moment a household writes its own. The read policy is narrowed
-- below to the shared set plus your own.

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- Arrays rather than free text so the planner can actually check them. An
-- allergy typed into a notes field is a note; an allergy in a list is
-- something the app can match an ingredient against and refuse.
alter table household_people
  add column if not exists allergies text[] not null default '{}',
  add column if not exists dislikes text[] not null default '{}',
  add column if not exists notes text;

comment on column household_people.allergies is
  'Allergens to screen recipes against. A screen, never a guarantee -- it matches ingredient text and cannot see inside a packaged product.';

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

alter table recipes
  add column if not exists household_id uuid references households (id) on delete cascade,
  add column if not exists meal_types text[] not null default '{}',
  add column if not exists notes text;

comment on column recipes.household_id is
  'Null means the shared starter set every household can see. Set means this household wrote it.';

-- A recipe usually suits more than one slot -- pasta is dinner or a packed
-- lunch -- so this is a set, not a single value.
alter table recipes drop constraint if exists recipes_meal_types_check;
alter table recipes
  add constraint recipes_meal_types_check
  check (meal_types <@ array['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER']::text[]);

create index if not exists recipes_household_idx on recipes (household_id);

-- Narrowed from "every authenticated user": the shared set, plus your own.
drop policy if exists "authenticated users can read recipes" on recipes;
drop policy if exists "members read shared and their own recipes" on recipes;
create policy "members read shared and their own recipes"
  on recipes for select to authenticated
  using (household_id is null or is_household_member(household_id));

drop policy if exists "members write their own recipes" on recipes;
create policy "members write their own recipes"
  on recipes for insert to authenticated
  with check (household_id is not null and is_household_member(household_id));

drop policy if exists "members update their own recipes" on recipes;
create policy "members update their own recipes"
  on recipes for update to authenticated
  using (household_id is not null and is_household_member(household_id))
  with check (household_id is not null and is_household_member(household_id));

drop policy if exists "members delete their own recipes" on recipes;
create policy "members delete their own recipes"
  on recipes for delete to authenticated
  using (household_id is not null and is_household_member(household_id));

-- Ingredients follow their recipe: writable only for a recipe you own, and the
-- shared set stays readable and unwritable.
drop policy if exists "members write ingredients on their own recipes" on recipe_ingredients;
create policy "members write ingredients on their own recipes"
  on recipe_ingredients for insert to authenticated
  with check (
    exists (
      select 1 from recipes r
      where r.id = recipe_id and r.household_id is not null and is_household_member(r.household_id)
    )
  );

drop policy if exists "members delete ingredients on their own recipes" on recipe_ingredients;
create policy "members delete ingredients on their own recipes"
  on recipe_ingredients for delete to authenticated
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_id and r.household_id is not null and is_household_member(r.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- What each person thinks of a recipe
-- ---------------------------------------------------------------------------

create table if not exists recipe_person_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  person_id uuid not null references household_people (id) on delete cascade,
  recipe_id uuid not null references recipes (id) on delete cascade,
  sentiment text not null check (sentiment in ('LOVES', 'DISLIKES')),
  created_at timestamptz not null default now(),
  unique (person_id, recipe_id)
);

create index if not exists recipe_person_preferences_household_idx
  on recipe_person_preferences (household_id);

alter table recipe_person_preferences enable row level security;

drop policy if exists "members manage their household's recipe opinions" on recipe_person_preferences;
create policy "members manage their household's recipe opinions"
  on recipe_person_preferences for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- The week
-- ---------------------------------------------------------------------------

create table if not exists meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  plan_date date not null,
  slot text not null check (slot in ('BREAKFAST', 'LUNCH', 'SNACK', 'DINNER')),
  -- A planned meal is either a recipe or a plain line. "Leftovers" and "pizza
  -- out" are real answers to what's for dinner and should not need a recipe
  -- invented for them, but an entry that names nothing at all is not a plan.
  recipe_id uuid references recipes (id) on delete set null,
  title text,
  -- Null means the whole household eats it; a person means it is theirs, which
  -- is what a school lunch is.
  person_id uuid references household_people (id) on delete cascade,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint meal_plan_entries_names_something check (recipe_id is not null or title is not null)
);

create index if not exists meal_plan_entries_week_idx
  on meal_plan_entries (household_id, plan_date);

alter table meal_plan_entries enable row level security;

drop policy if exists "members manage their household's meal plan" on meal_plan_entries;
create policy "members manage their household's meal plan"
  on meal_plan_entries for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- The starter recipes suit dinner, which is where they were being used.
-- ---------------------------------------------------------------------------

update recipes
set meal_types = array['DINNER']::text[]
where household_id is null and meal_types = '{}'::text[];
