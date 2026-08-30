-- Phase 2B.1 step 2: catalogue-data correction, not a search-algorithm
-- change. "steak" should surface Beef Tenderloin alongside the other cuts
-- (Striploin, Ribeye, Sirloin) — it was missing "steak" from its aliases,
-- so the (correct, unchanged) substring search never matched it.
-- Idempotent: only adds the alias if it isn't already present.

update catalog_products
set search_aliases = array_append(search_aliases, 'steak')
where id = 'beef-tenderloin'
  and not ('steak' = any(search_aliases));
