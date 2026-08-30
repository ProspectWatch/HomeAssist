-- Phase 2D step 1/2: extend the EXISTING household preference layer rather
-- than adding a parallel model. household_product_preferences already carried
-- preferred_brand/variant/size/retailer, acceptable_brands/stores,
-- brand_rigidity, typical_quantity and notes; Phase 2D adds the two fields it
-- was missing:
--
--   regular_buy    -- "the household commonly keeps/buys this". Deliberately a
--                     preference-layer flag, NOT an inventory fact: it says
--                     nothing about whether the item is in stock right now.
--                     Pantry inventory stays where it already lives
--                     (products.stock_status), so catalogue / preference /
--                     regular-buy / inventory stay four separate concepts.
--   stock_location -- where the household keeps it (Fridge, Pantry, …).
--
-- acceptable_retailers is intentionally not added: acceptable_stores (text[])
-- already serves that role and is what the shopping engine reads today.

alter table household_product_preferences
  add column if not exists regular_buy boolean not null default false,
  add column if not exists stock_location text;

create index if not exists household_product_preferences_regular_buy_idx
  on household_product_preferences (household_id)
  where regular_buy;

-- Catalogue gaps found auditing the Phase 2D household list against the
-- existing 177 products. Only genuinely missing generic concepts are added —
-- everything else on that list already exists and is reused as-is.
--
-- "Potatoes" and "New York Strip" follow the precedent set in 0010 (a generic
-- concept living alongside its named varieties, e.g. bell-peppers next to
-- red/yellow/green). No brand is guessed for any of these.
insert into catalog_products
  (id, normalized_name, display_name, brand, category, subcategory, search_aliases, default_unit,
   image_url, image_ready, source, source_notes, preferred_store_hint, preferred_retailer_id, active, manually_edited)
values
  ('potatoes', 'potatoes', 'Potatoes', null, 'Produce', 'Vegetables',
   array['potato', 'white potatoes'], 'bag', '/images/products/potatoes.jpg', true,
   'manual', 'Added in Phase 2D as the generic potato the household buys, distinct from the Russet/Yukon Gold/Baby varieties already in the catalogue. Reuses the existing generic potato photo.', null, null, true, false),
  ('new-york-strip', 'new york strip', 'New York Strip', null, 'Meat & Seafood', 'Beef',
   array['ny strip', 'new york strip steak', 'strip steak', 'steak'], 'lb', null, false,
   'manual', 'Added in Phase 2D: the household names New York Strip as a preferred steak cut alongside Striploin. No image sourced yet — see docs/image-acquisition-manifest.csv.', null, null, true, false),
  ('toast-bread', 'toast bread', 'Toast Bread', null, 'Pantry', 'Bread',
   array['toasting bread', 'thick sliced bread', 'bread'], 'loaf', null, false,
   'manual', 'Added in Phase 2D: the household keeps a toasting loaf separate from sandwich bread. No brand assumed.', null, null, true, false)
on conflict (id) do nothing;

-- "Chicken Fingers" is the same product as Frozen Chicken Strips, so it
-- becomes a search alias rather than a duplicate catalogue row.
update catalog_products
set search_aliases = array_append(search_aliases, 'chicken fingers')
where id = 'frozen-chicken-strips'
  and not ('chicken fingers' = any(search_aliases));
