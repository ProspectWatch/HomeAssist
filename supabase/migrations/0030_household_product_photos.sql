-- Let a household put its own photograph on a product.
--
-- Two things were missing, and together they made this impossible rather than
-- merely unbuilt.
--
-- 1. Nowhere to put the photo. A catalogue-backed regular buy lives in
--    household_product_preferences, which has no image column, so its picture
--    could only ever come from catalog_products.image_url -- a row shared by
--    every household. Writing a family's fridge photo there would change the
--    picture for everyone and collide with the one-product-per-image unique
--    index from 0027. The household layer needs its own slot, and the read
--    path prefers it: your photo of your ketchup beats the stock photograph,
--    and neither one overwrites the other.
--
-- 2. Nowhere to put the bytes. The product-images bucket has a public read
--    policy and no insert policy, so every upload was denied -- the same shape
--    of hole as 0019 and 0029. Scoped to a folder named for the household, so
--    one household cannot overwrite another's photographs. The bucket stays
--    public-read on purpose: these are pictures of groceries, the URLs are
--    already in the page, and a signed URL per tile would buy nothing.

alter table household_product_preferences
  add column if not exists image_url text;

comment on column household_product_preferences.image_url is
  'A photo this household took. Preferred over catalog_products.image_url, which is shared by every household.';

drop policy if exists "household members upload their product photos" on storage.objects;
create policy "household members upload their product photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "household members replace their product photos" on storage.objects;
create policy "household members replace their product photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'product-images'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "household members delete their product photos" on storage.objects;
create policy "household members delete their product photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and is_household_member(((storage.foldername(name))[1])::uuid)
  );
