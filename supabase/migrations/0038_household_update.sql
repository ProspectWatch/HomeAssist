-- Members can rename their own household.
--
-- Settings has always offered a household name field and saveHouseholdSettings
-- has always tried to write it, but `households` carried only INSERT and
-- SELECT policies. An UPDATE matching no rows is not an error, so the action
-- returned ok, the screen said saved, and the name never changed. The postal
-- code and preferred stores next to it saved correctly the whole time, which
-- is why this looked like it worked.
create policy "members update their own household" on public.households
  for update using (is_household_member(id))
  with check (is_household_member(id));
