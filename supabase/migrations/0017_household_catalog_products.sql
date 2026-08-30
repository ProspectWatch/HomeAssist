-- "Create all the product categories and products."
--
-- product_categories and product_subcategories are FK targets for
-- catalog_products, so the taxonomy is real structure: a category that isn't
-- seeded here cannot be used at all. A real Fortinos receipt proved the gap —
-- chips, candy and soft drinks had nowhere to file and came back UNMATCHED.
--
-- Nothing existing is renamed or removed: live products reference these rows.

insert into product_categories (name, sort_order) values
  ('Bakery', 8),
  ('Snacks', 9),
  ('Confectionery', 10),
  ('Health & Beauty', 11),
  ('Baby & Kids', 12),
  ('Pet', 13)
on conflict (name) do nothing;

-- Every (category, subcategory) pair the app offers. Existing rows are
-- untouched by the conflict clause; the new ones are the additions.
insert into product_subcategories (category, name, sort_order) values
  ('Produce', 'Leafy Greens', 0),
  ('Produce', 'Vegetables', 1),
  ('Produce', 'Fruit', 2),
  ('Meat & Seafood', 'Beef', 0),
  ('Meat & Seafood', 'Poultry', 1),
  ('Meat & Seafood', 'Pork', 2),
  ('Meat & Seafood', 'Prepared Meat', 3),
  ('Meat & Seafood', 'Seafood', 4),
  ('Dairy & Eggs', 'Milk', 0),
  ('Dairy & Eggs', 'Eggs', 1),
  ('Dairy & Eggs', 'Cheese', 2),
  ('Dairy & Eggs', 'Dairy', 3),
  ('Deli & Prepared', 'Deli', 0),
  ('Deli & Prepared', 'Prepared Meals', 1),
  ('Bakery', 'Bread', 0),
  ('Bakery', 'Buns & Rolls', 1),
  ('Bakery', 'Sweet Baked', 2),
  ('Bakery', 'Tortillas & Wraps', 3),
  ('Pantry', 'Bread', 0),
  ('Pantry', 'Breakfast', 1),
  ('Pantry', 'Baking', 2),
  ('Pantry', 'Pasta & Rice', 3),
  ('Pantry', 'Sauces', 4),
  ('Pantry', 'Condiments', 5),
  ('Pantry', 'Oils', 6),
  ('Pantry', 'Spices', 7),
  ('Pantry', 'Meal Kits', 8),
  ('Pantry', 'Soup & Broth', 9),
  ('Pantry', 'Snacks', 10),
  ('Snacks', 'Chips', 0),
  ('Snacks', 'Crackers', 1),
  ('Snacks', 'Popcorn & Puffs', 2),
  ('Snacks', 'Nuts & Seeds', 3),
  ('Snacks', 'Bars & Granola', 4),
  ('Confectionery', 'Candy', 0),
  ('Confectionery', 'Chocolate', 1),
  ('Confectionery', 'Fruit Snacks', 2),
  ('Confectionery', 'Gum & Mints', 3),
  ('Frozen', 'Frozen Meals', 0),
  ('Frozen', 'Frozen Meat', 1),
  ('Frozen', 'Frozen Sides', 2),
  ('Frozen', 'Frozen Vegetables', 3),
  ('Frozen', 'Frozen Dessert', 4),
  ('Drinks', 'Juice', 0),
  ('Drinks', 'Kids Drinks', 1),
  ('Drinks', 'Tea', 2),
  ('Drinks', 'Water', 3),
  ('Drinks', 'Coffee', 4),
  ('Drinks', 'Soft Drinks', 5),
  ('Drinks', 'Sports & Energy', 6),
  ('Household', 'Laundry', 0),
  ('Household', 'Dishwashing', 1),
  ('Household', 'Cleaning', 2),
  ('Household', 'Paper', 3),
  ('Household', 'Waste', 4),
  ('Household', 'Storage', 5),
  ('Household', 'Personal Care', 6),
  ('Household', 'Pet', 7),
  ('Household', 'Home Supplies', 8),
  ('Health & Beauty', 'Personal Care', 0),
  ('Health & Beauty', 'Hair', 1),
  ('Health & Beauty', 'Oral Care', 2),
  ('Health & Beauty', 'Medicine Cabinet', 3),
  ('Health & Beauty', 'Skin Care', 4),
  ('Baby & Kids', 'Diapers & Wipes', 0),
  ('Baby & Kids', 'Baby Food', 1),
  ('Baby & Kids', 'Baby Care', 2),
  ('Pet', 'Dog', 0),
  ('Pet', 'Cat', 1),
  ('Pet', 'Pet Supplies', 2)
on conflict (category, name) do nothing;

-- Receipt review can now add a missing product to the catalogue, so the
-- catalogue needs to be writable by a signed-in member — it was read-only.
-- The check pins source = 'household': a product added through the app can
-- never claim to be part of the seeded product library, so provenance stays
-- honest and auditable.
drop policy if exists "signed-in users can add catalog products" on catalog_products;
create policy "signed-in users can add catalog products"
  on catalog_products for insert to authenticated
  with check (source = 'household');

-- Products read off that Fortinos receipt (2026-08-30) whose abbreviation
-- names an unmistakable product. Only these four: the remaining unmatched
-- lines ("BNJ CA IC VANILL", "FLNT CRML CK CRN", "RIGH COOK&CREAM",
-- "JYPR RNBW FRUIT", "ITAL ICES RNBW F", "RAINBOW STRIPS", "COMBO BANG LEAN")
-- are NOT decodable with confidence, and a guessed product name would become
-- shared household data and poison future matching. Those are left for the
-- household to name in review, which is what the new flow is for.
--
-- search_aliases carries the raw receipt text so the same shorthand matches
-- itself next shop. No price, size or image is asserted here.
insert into catalog_products
  (id, display_name, normalized_name, brand, category, subcategory, search_aliases,
   default_unit, source, source_notes, image_ready, manually_edited)
values
  ('lays-old-fashioned-bbq-chips', 'Lay''s Old Fashioned BBQ Chips',
   product_search_normalize('Lay''s Old Fashioned BBQ Chips'), 'Lay''s',
   'Snacks', 'Chips', array['lays old fsh bbq', 'lays bbq', 'old fashioned bbq chips'],
   'bag', 'household', 'Added from receipt text "LAYS OLD FSH BBQ"', false, true),

  ('coca-cola-fridge-pack', 'Coca-Cola Fridge Pack',
   product_search_normalize('Coca-Cola Fridge Pack'), 'Coca-Cola',
   'Drinks', 'Soft Drinks', array['coca cola fridge', 'coke fridge pack', 'coca cola'],
   'pack', 'household', 'Added from receipt text "COCA-COLA FRIDGE"', false, true),

  ('sumol-passion-fruit', 'Sumol Passion Fruit',
   product_search_normalize('Sumol Passion Fruit'), 'Sumol',
   'Drinks', 'Juice', array['sumol psnfrt jce', 'sumol passionfruit', 'sumol'],
   'pack', 'household', 'Added from receipt text "SUMOL PSNFRT.JCE"', false, true),

  ('natrel-2-percent-lactose-free-milk', 'Natrel 2% Lactose Free Milk',
   product_search_normalize('Natrel 2% Lactose Free Milk'), 'Natrel',
   'Dairy & Eggs', 'Milk', array['natrel 2 lact o', 'natrel lactose free', 'lactose free milk'],
   'carton', 'household', 'Added from receipt text "NATREL 2% LACT O"', false, true)
on conflict (id) do nothing;
