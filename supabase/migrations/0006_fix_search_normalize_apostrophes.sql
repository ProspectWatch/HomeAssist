-- product_search_normalize() was replacing an apostrophe with a space,
-- splitting "Earth's" into "earth" + "s" instead of "earths" — so typing
-- "earths own" (the common way to type it without an apostrophe) failed
-- to match "Earth's Own". Apostrophes should be dropped entirely; other
-- punctuation (hyphens, etc.) still becomes a space.
create or replace function product_search_normalize(input text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      regexp_replace(lower(coalesce(input, '')), '[''’]', '', 'g'),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

-- Recompute search_text for every existing row now that the function
-- behaves differently (the trigger fires on any UPDATE, regardless of
-- which columns actually change).
update catalog_products set updated_at = now();

-- normalized_name was set at import time using the old (buggy) client-side
-- logic too; recompute it the same way so it matches search_text's rules.
update catalog_products set normalized_name = product_search_normalize(display_name);
