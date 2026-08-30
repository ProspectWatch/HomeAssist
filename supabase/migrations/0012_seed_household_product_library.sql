-- Phase 2D step 2/2: seed a household's product library — the regular buys it
-- keeps on hand, plus the brand/variant/store rules that describe HOW it wants
-- them bought.
--
-- This REPLACES the body of the existing seed_starter_household_preferences()
-- (introduced in 0004) rather than adding a second seeding path. Onboarding
-- already calls it with the newly-created household's id, so no household id
-- is hardcoded anywhere in application code or in this function.
--
-- Idempotent by construction: every insert is keyed on the existing
-- (household_id, scope_type, scope_key) unique constraint. Running it twice
-- produces no duplicates. The regular-buy pass never clobbers preference
-- fields, and never overwrites a stock_location that is already set.

create or replace function seed_starter_household_preferences(target_household_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  -- Pass 1 — REGULAR BUYS.
  -- "Regular buy" means the household commonly keeps or buys this. It is NOT
  -- an inventory claim: nothing here asserts the item is currently in stock.
  -- Joining catalog_products means the label always tracks the real catalogue
  -- row, and any id that does not exist is silently skipped instead of
  -- creating an orphan preference.
  insert into household_product_preferences
    (household_id, scope_type, scope_key, label, regular_buy, stock_location)
  select target_household_id, 'product', cp.id, cp.display_name, true, v.stock_location
  from (values
    -- Produce — vegetables
    ('green-leaf-lettuce','Fridge'), ('iceberg-lettuce','Fridge'), ('romaine-lettuce','Fridge'),
    ('tomatoes','Counter'), ('grape-tomatoes','Fridge'), ('cherry-tomatoes','Fridge'),
    ('english-cucumber','Fridge'), ('mini-cucumbers','Fridge'),
    ('red-bell-pepper','Fridge'), ('yellow-bell-pepper','Fridge'), ('green-bell-pepper','Fridge'),
    ('white-onion','Pantry'), ('yellow-onion','Pantry'), ('red-onion','Pantry'), ('green-onion','Fridge'),
    ('corn-on-the-cob','Fridge'), ('broccoli','Fridge'), ('cauliflower','Fridge'),
    ('carrots','Fridge'), ('celery','Fridge'), ('garlic','Pantry'), ('mushrooms','Fridge'),
    ('zucchini','Fridge'), ('asparagus','Fridge'), ('green-beans','Fridge'),
    ('potatoes','Pantry'), ('sweet-potato','Pantry'),
    -- Produce — fruit
    ('bananas','Counter'), ('apples','Fridge'), ('strawberries','Fridge'), ('blueberries','Fridge'),
    ('raspberries','Fridge'), ('green-grapes','Fridge'), ('red-grapes','Fridge'),
    ('oranges','Fridge'), ('lemons','Fridge'), ('limes','Fridge'), ('avocados','Counter'),
    ('pineapple','Counter'), ('watermelon','Fridge'), ('cantaloupe','Fridge'), ('kiwi','Fridge'),
    -- Meat & seafood
    ('boneless-skinless-chicken-breast','Freezer'), ('ground-beef','Freezer'),
    ('lean-ground-beef','Freezer'), ('fast-fry-beef','Freezer'),
    ('aaa-striploin-steak','Freezer'), ('new-york-strip','Freezer'), ('ribeye-steak','Freezer'),
    ('sirloin-steak','Freezer'), ('beef-tenderloin','Freezer'), ('beef-roast','Freezer'),
    ('stewing-beef','Freezer'), ('pork-chops','Freezer'), ('pork-tenderloin','Freezer'),
    ('pork-back-ribs','Freezer'), ('ground-pork','Freezer'), ('meatballs','Freezer'),
    ('burgers','Freezer'), ('italian-sausage','Freezer'), ('atlantic-salmon-fillet','Freezer'),
    ('shrimp','Freezer'), ('cod-fillet','Freezer'), ('haddock-fillet','Freezer'),
    -- Dairy & eggs
    ('earth-s-own-original-almond-milk','Fridge'), ('2-lactose-free-milk','Fridge'),
    ('neilson-2-milk-4-l','Fridge'), ('conestoga-brown-free-range-eggs','Fridge'),
    ('cheddar-cheese-block','Fridge'), ('shredded-tex-mex-cheese','Fridge'),
    ('butter','Fridge'), ('cream-cheese','Fridge'), ('greek-yogurt','Fridge'),
    ('yogurt','Fridge'), ('sour-cream','Fridge'),
    -- Bakery / breakfast / pantry staples
    ('cinnamon-toast-crunch','Pantry'), ('bisquick','Pantry'), ('sandwich-bread','Counter'),
    ('toast-bread','Counter'), ('tortillas','Pantry'), ('rice','Pantry'), ('pasta','Pantry'),
    ('pasta-sauce','Pantry'), ('oatmeal','Pantry'),
    -- Condiments & sauces
    ('ketchup','Fridge'), ('mayonnaise','Fridge'), ('dijon-mustard','Fridge'),
    ('barbecue-sauce','Pantry'), ('peanut-butter','Pantry'), ('jam','Fridge'),
    -- Baking, oils & spices
    ('olive-oil','Pantry'), ('vegetable-oil','Pantry'), ('chili-powder','Pantry'),
    ('steak-spice','Pantry'), ('mustard-powder','Pantry'), ('fajita-seasoning','Pantry'),
    ('taco-kit','Pantry'), ('panko-bread-crumbs','Pantry'), ('chicken-broth','Pantry'),
    ('ritz-crackers','Pantry'),
    -- Frozen
    ('frozen-chicken-strips','Freezer'), ('french-fries','Freezer'), ('frozen-pizza','Freezer'),
    ('frozen-mixed-vegetables','Freezer'), ('ice-cream','Freezer'), ('gelato','Freezer'),
    ('popsicles','Freezer'),
    -- Deli & prepared
    ('deli-meat','Fridge'), ('marilu-s-mac-and-cheese','Fridge'),
    -- Drinks
    ('orange-juice','Fridge'), ('juice-boxes','Pantry'), ('iced-tea','Pantry'),
    ('decaf-tea','Pantry'), ('bottled-water','Pantry'), ('coffee','Pantry'),
    -- Laundry
    ('laundry-detergent','Laundry Room'), ('laundry-pods','Laundry Room'),
    ('fabric-softener','Laundry Room'), ('stain-remover','Laundry Room'),
    -- Dishwashing
    ('dishwasher-pods','Under Sink'), ('dishwasher-soap','Under Sink'), ('dish-soap','Under Sink'),
    -- Cleaning
    ('all-purpose-cleaner','Under Sink'), ('mr-clean','Under Sink'), ('lysol','Under Sink'),
    ('disinfecting-wipes','Under Sink'), ('glass-cleaner','Under Sink'),
    ('bathroom-cleaner','Bathroom'), ('toilet-bowl-cleaner','Bathroom'),
    -- Paper & disposable
    ('paper-towels','Storage Closet'), ('toilet-paper','Storage Closet'),
    ('garbage-bags','Under Sink'), ('recycle-bags','Under Sink'),
    -- Kitchen storage
    ('ziploc-bags','Kitchen Drawer'), ('food-storage-bags','Kitchen Drawer'),
    ('plastic-wrap','Kitchen Drawer'), ('aluminum-foil','Kitchen Drawer'),
    ('parchment-paper','Kitchen Drawer'),
    -- Bathroom & personal care
    ('deodorant','Bathroom'), ('shampoo','Bathroom'), ('conditioner','Bathroom'),
    ('body-wash','Bathroom'), ('hand-soap','Bathroom'), ('toothpaste','Bathroom'),
    ('toothbrush','Bathroom'), ('razors','Bathroom')
  ) as v(catalog_id, stock_location)
  join catalog_products cp on cp.id = v.catalog_id and cp.active
  on conflict (household_id, scope_type, scope_key) do update
    set regular_buy = true,
        -- never overwrite a location the household has already set
        stock_location = coalesce(household_product_preferences.stock_location, excluded.stock_location),
        updated_at = now();

  -- Pass 2 — PREFERENCE RULES: how the household wants these bought.
  -- preferred_retailer_id is resolved from the retailers table by name so the
  -- shopping engine gets a real retailer reference, not just a text hint.
  --
  -- A store preference is an ADVANTAGE, not a mandate: the trip optimizer
  -- applies it as a tie-break within a small tolerance, so a preferred store
  -- never forces an extra trip for negligible savings.
  insert into household_product_preferences
    (household_id, scope_type, scope_key, label, preferred_brand, preferred_variant,
     preferred_store, preferred_retailer_id, acceptable_brands, acceptable_stores,
     brand_rigidity, typical_quantity, regular_buy, notes)
  select target_household_id, v.scope_type, v.scope_key, v.label, v.preferred_brand,
         v.preferred_variant, v.preferred_store, r.id, v.acceptable_brands,
         v.acceptable_stores, v.brand_rigidity, v.typical_quantity, v.regular_buy, v.notes
  from (values
    -- Produce generally leans to Marilu's Market — an advantage when price and
    -- convenience are close, never an instruction to always shop there.
    ('category', 'Produce', 'Produce', null::text, null::text, 'Marilu''s Market',
     '{}'::text[], '{}'::text[], 'FLEXIBLE', null::text, false,
     'Marilu''s Market is generally preferred for fruit and vegetables. This is a preference advantage applied when price/convenience differences are small — not a rule to always buy produce there.'),

    -- Meat & seafood store rules
    ('subcategory', 'Poultry', 'Chicken', null, null, 'Marilu''s Market',
     '{}'::text[], '{}'::text[], 'FLEXIBLE', null, false,
     'Chicken breast is preferred from Marilu''s Market.'),
    ('subcategory', 'Beef', 'Steak & Beef', null, null, 'Marilu''s Market',
     '{}'::text[], '{Costco}'::text[], 'FLEXIBLE', null, false,
     'Steak is preferred from Marilu''s Market; Costco is an acceptable alternative.'),
    ('subcategory', 'Pork', 'Pork', null, null, 'Fortinos',
     '{}'::text[], '{}'::text[], 'FLEXIBLE', null, false,
     'Pork is preferred from Fortinos.'),

    -- Product-level meat rules
    ('product', 'boneless-skinless-chicken-breast', 'Chicken Breast', null, null, 'Marilu''s Market',
     '{}'::text[], '{}'::text[], 'FLEXIBLE', null, true, 'Preferred from Marilu''s Market.'),
    ('product', 'aaa-striploin-steak', 'Striploin Steak', null, 'Striploin', 'Marilu''s Market',
     '{}'::text[], '{Costco}'::text[], 'FLEXIBLE', null, true,
     'Striploin and New York Strip are the household''s preferred steak cuts. Marilu''s Market preferred; Costco acceptable.'),
    ('product', 'new-york-strip', 'New York Strip', null, 'New York Strip', 'Marilu''s Market',
     '{}'::text[], '{Costco}'::text[], 'FLEXIBLE', null, true,
     'Striploin and New York Strip are the household''s preferred steak cuts. Marilu''s Market preferred; Costco acceptable.'),
    ('product', 'ribeye-steak', 'Ribeye Steak', null, null, 'Marilu''s Market',
     '{}'::text[], '{Costco}'::text[], 'FLEXIBLE', null, true, 'Marilu''s Market preferred; Costco acceptable.'),
    ('product', 'sirloin-steak', 'Sirloin Steak', null, null, 'Marilu''s Market',
     '{}'::text[], '{Costco}'::text[], 'FLEXIBLE', null, true, 'Marilu''s Market preferred; Costco acceptable.'),
    ('product', 'beef-tenderloin', 'Beef Tenderloin', null, null, 'Marilu''s Market',
     '{}'::text[], '{Costco}'::text[], 'FLEXIBLE', null, true, 'Marilu''s Market preferred; Costco acceptable.'),
    ('product', 'fast-fry-beef', 'Fast-Fry Beef', null, null, 'Fortinos',
     '{}'::text[], '{}'::text[], 'FLEXIBLE', null, true, 'Preferred from Fortinos.'),

    -- Dairy & eggs brand/variant rules
    ('product', 'earth-s-own-original-almond-milk', 'Almond Milk', 'Earth''s Own', 'Original', null,
     '{}'::text[], '{}'::text[], 'PREFERRED', null, true,
     'Earth''s Own Original is the preferred almond milk.'),
    ('subcategory', 'Milk', 'Milk', null, '2% Lactose-Free', null,
     '{Lactantia,Neilson}'::text[], '{}'::text[], 'PREFERRED', null, false,
     'Must be 2% lactose-free — regular lactose-containing milk is not an acceptable substitute. Either Lactantia or Neilson is equally fine.'),
    ('subcategory', 'Eggs', 'Eggs', 'Conestoga', 'Brown, Free-Range', 'Food Basics',
     '{}'::text[], '{}'::text[], 'PREFERRED', null, false,
     'Conestoga brown free-range eggs, preferred from Food Basics.'),
    ('product', 'conestoga-brown-free-range-eggs', 'Eggs', 'Conestoga', 'Brown, Free-Range', 'Food Basics',
     '{}'::text[], '{}'::text[], 'PREFERRED', null, true,
     'Conestoga brown free-range eggs, preferred from Food Basics.'),
    ('product', 'shredded-tex-mex-cheese', 'Shredded Cheese', null, 'Tex-Mex', null,
     '{}'::text[], '{}'::text[], 'PREFERRED', null, true,
     'Tex-Mex is the preferred shredded cheese blend.')
  ) as v(scope_type, scope_key, label, preferred_brand, preferred_variant, preferred_store,
         acceptable_brands, acceptable_stores, brand_rigidity, typical_quantity, regular_buy, notes)
  left join retailers r on r.name = v.preferred_store
  on conflict (household_id, scope_type, scope_key) do update
    set label = excluded.label,
        preferred_brand = excluded.preferred_brand,
        preferred_variant = excluded.preferred_variant,
        preferred_store = excluded.preferred_store,
        preferred_retailer_id = excluded.preferred_retailer_id,
        acceptable_brands = excluded.acceptable_brands,
        acceptable_stores = excluded.acceptable_stores,
        brand_rigidity = excluded.brand_rigidity,
        -- a product-level rule that is also a regular buy must not lose that
        -- flag just because pass 2 ran after pass 1
        regular_buy = household_product_preferences.regular_buy or excluded.regular_buy,
        notes = excluded.notes,
        updated_at = now();
end
$$;
