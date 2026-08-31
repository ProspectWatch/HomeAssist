-- Ingredients follow their recipe's visibility.
--
-- 0032 narrowed the recipes read policy so a household's own recipes stopped
-- being readable by every authenticated user. recipe_ingredients was left
-- behind: SELECT was `true` and UPDATE was `true`/`true`, so the recipe name
-- was private while its ingredient list was readable — and rewritable — by
-- anyone signed in to any household. Editing recipes is what made that worth
-- fixing now rather than later.
--
-- Read follows the recipe: the shared starter set, plus your own. Write is
-- your own only, which also matches insert and delete, already scoped that way.

drop policy if exists "authenticated users can read recipe ingredients" on public.recipe_ingredients;
create policy "members read shared and their own recipe ingredients"
  on public.recipe_ingredients
  for select using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and (r.household_id is null or is_household_member(r.household_id))
    )
  );

-- Was `true`/`true`: any signed-in user could rewrite any ingredient line in
-- any household's recipe. Linking an ingredient to a catalogue product on a
-- SHARED recipe is also dropped by this, deliberately — that row belongs to
-- every household, and one household's linking decision should not land on
-- everyone else's copy.
drop policy if exists "authenticated users can map recipe ingredients to the catalog" on public.recipe_ingredients;
create policy "members update ingredients on their own recipes"
  on public.recipe_ingredients
  for update using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.household_id is not null
        and is_household_member(r.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.household_id is not null
        and is_household_member(r.household_id)
    )
  );
