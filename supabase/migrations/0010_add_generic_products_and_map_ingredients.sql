-- Phase 2B.1 step 3: complete recipe-ingredient mapping. Six recipe
-- ingredients (Parmesan Wedge, Salsa, Soy Sauce, Taco Seasoning, Baby
-- Potatoes, Bell Peppers) have no equivalent catalogue product at all, so
-- a genuinely generic one is added first, then mapped. Marinara Sauce
-- maps to the existing generic "Pasta Sauce" (same precedent as
-- Jasmine Rice -> Rice / Spaghetti -> Pasta in 0008: a specific recipe
-- ingredient mapping to its broader generic catalogue concept).
--
-- No brand is guessed for any of these (all brand fields stay null).
-- Bell Peppers and Baby Potatoes reuse the existing bell-peppers.jpg /
-- potatoes.jpg photos already shared across the color/variety-specific
-- products they generalize — a real, accurate image, not a fabrication
-- (step 6: legitimate image reuse across related generic concepts).
-- Parmesan/Salsa/Soy Sauce/Taco Seasoning get no image yet (image_ready
-- stays false) rather than a guessed or stock photo — see the Phase
-- 2B.1 image acquisition manifest for these.

insert into catalog_products
  (id, normalized_name, display_name, brand, category, subcategory, search_aliases, default_unit,
   image_url, image_ready, source, source_notes, preferred_store_hint, preferred_retailer_id, active, manually_edited)
values
  ('parmesan-cheese', 'parmesan cheese', 'Parmesan Cheese', null, 'Dairy & Eggs', 'Cheese',
   array['parmesan', 'parmesan wedge', 'parm'], 'wedge', null, false,
   'manual', 'Added in Phase 2B.1 to map the "Parmesan Wedge" recipe ingredient — no brand assumed.', null, null, true, false),
  ('salsa', 'salsa', 'Salsa', null, 'Pantry', 'Condiments',
   array['salsa sauce'], 'jar', null, false,
   'manual', 'Added in Phase 2B.1 to map the "Salsa" recipe ingredient — no brand assumed.', null, null, true, false),
  ('soy-sauce', 'soy sauce', 'Soy Sauce', null, 'Pantry', 'Condiments',
   array['soya sauce'], 'bottle', null, false,
   'manual', 'Added in Phase 2B.1 to map the "Soy Sauce" recipe ingredient — no brand assumed.', null, null, true, false),
  ('taco-seasoning', 'taco seasoning', 'Taco Seasoning', null, 'Pantry', 'Spices',
   array['taco spice mix', 'taco seasoning mix'], 'packet', null, false,
   'manual', 'Added in Phase 2B.1 to map the "Taco Seasoning" recipe ingredient — no brand assumed (distinct from the existing "Taco Kit" meal-kit product).', null, null, true, false),
  ('baby-potatoes', 'baby potatoes', 'Baby Potatoes', null, 'Produce', 'Vegetables',
   array['baby potato', 'mini potatoes', 'creamer potatoes'], 'bag', '/images/products/potatoes.jpg', true,
   'manual', 'Added in Phase 2B.1 as a generic product distinct from Russet/Yukon Gold, so the "Baby Potatoes" recipe ingredient is not mapped to an unrelated variety. Reuses the existing generic potatoes photo.', null, null, true, false),
  ('bell-peppers', 'bell peppers', 'Bell Peppers', null, 'Produce', 'Vegetables',
   array['bell pepper', 'peppers', 'mixed peppers'], 'each', '/images/products/bell-peppers.jpg', true,
   'manual', 'Added in Phase 2B.1 as a generic product so the "Bell Peppers" recipe ingredient is not arbitrarily assigned to red/yellow/green. Reuses the existing shared bell pepper photo.', null, null, true, false)
on conflict (id) do nothing;

update recipe_ingredients set catalog_product_id = v.cid
from (values
  ('Marinara Sauce', 'pasta-sauce'),
  ('Parmesan Wedge', 'parmesan-cheese'),
  ('Salsa', 'salsa'),
  ('Soy Sauce', 'soy-sauce'),
  ('Taco Seasoning', 'taco-seasoning'),
  ('Baby Potatoes', 'baby-potatoes'),
  ('Bell Peppers', 'bell-peppers')
) as v(name, cid)
where recipe_ingredients.name = v.name
  and recipe_ingredients.catalog_product_id is null;
