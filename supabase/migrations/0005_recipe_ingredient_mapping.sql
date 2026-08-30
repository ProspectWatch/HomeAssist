-- Recipes are global/shared reference content (no household_id, same as
-- 0002's recipe seed), so mapping an ingredient to a generic catalogue
-- product (step 10) is likewise a shared edit, not a household-scoped one.
create policy "authenticated users can map recipe ingredients to the catalog"
  on recipe_ingredients for update
  to authenticated
  using (true)
  with check (true);
