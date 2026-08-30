-- Phase 2B step 10: point recipe ingredients at the generic catalogue
-- product they mean, so shopping-time resolution (variant/store/deal) can
-- happen later without ever hard-coding a retailer into the recipe itself.
-- Only mapped where the match is unambiguous — several ingredients
-- (Marinara Sauce, Parmesan Wedge, Salsa, Soy Sauce, Taco Seasoning, Baby
-- Potatoes, the generic "Bell Peppers") have no equivalent single catalog
-- product and are deliberately left unmapped rather than guessed.
-- Idempotent: only fills rows that are still unmapped.

update recipe_ingredients set catalog_product_id = v.cid
from (values
  ('Asparagus', 'asparagus'),
  ('Broccoli Crowns', 'broccoli'),
  ('Chicken Breast', 'boneless-skinless-chicken-breast'),
  ('Frozen Meatballs', 'meatballs'),
  ('Ground Beef', 'ground-beef'),
  ('Jasmine Rice', 'rice'),
  ('Lemons', 'lemons'),
  ('Salmon Fillets', 'atlantic-salmon-fillet'),
  ('Shredded Tex-Mex Cheese', 'shredded-tex-mex-cheese'),
  ('Soft Flour Tortillas', 'tortillas'),
  ('Spaghetti', 'pasta')
) as v(name, cid)
where recipe_ingredients.name = v.name
  and recipe_ingredients.catalog_product_id is null;
