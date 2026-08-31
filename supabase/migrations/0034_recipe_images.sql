-- Photographs on a recipe: one cover, and a gallery of however many others.
--
-- A recipe imported from a website arrives as text. What it looked like the
-- last time this kitchen made it is the household's own record, and the two
-- are different things: the cover is how the recipe is recognised in a list,
-- the gallery is the steps, the plating, the note in somebody's handwriting.
--
-- Photos live in the existing product-images bucket under the household's own
-- folder, which is what the storage policies from 0030 already gate on. No new
-- bucket and no new storage policy: same isolation boundary, one fewer thing
-- that can be got wrong.

-- Both the cover and the gallery live here rather than on the recipe row. A
-- shared starter recipe has no household_id and RLS rightly refuses to update
-- it, so a cover column on `recipes` could never be set for the starter set;
-- on this table every photo is household-owned whichever recipe it is of.
create table if not exists public.recipe_images (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- Carried on the row rather than reached through the recipe, because a
  -- shared starter recipe has no household_id and its photos still belong to
  -- exactly one household.
  household_id uuid not null references public.households (id) on delete cascade,
  image_url text not null,
  caption text,
  -- The one shown at the top of the recipe and in the list.
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists recipe_images_recipe_idx
  on public.recipe_images (recipe_id, sort_order);
create index if not exists recipe_images_household_idx
  on public.recipe_images (household_id);
create unique index if not exists recipe_images_one_cover_idx
  on public.recipe_images (recipe_id, household_id)
  where is_cover;

alter table public.recipe_images enable row level security;

drop policy if exists "recipe_images_select" on public.recipe_images;
create policy "recipe_images_select" on public.recipe_images
  for select using (is_household_member(household_id));

drop policy if exists "recipe_images_insert" on public.recipe_images;
create policy "recipe_images_insert" on public.recipe_images
  for insert with check (is_household_member(household_id));

drop policy if exists "recipe_images_update" on public.recipe_images;
create policy "recipe_images_update" on public.recipe_images
  for update using (is_household_member(household_id))
  with check (is_household_member(household_id));

drop policy if exists "recipe_images_delete" on public.recipe_images;
create policy "recipe_images_delete" on public.recipe_images
  for delete using (is_household_member(household_id));
