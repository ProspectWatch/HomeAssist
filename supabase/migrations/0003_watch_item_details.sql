-- Small follow-up to 0002: fields needed by the "Watch Product" /
-- "Add Owned Product" form (category label, and size/fit for sports gear).

alter table watch_items
  add column category text,
  add column size text,
  add column fit text;
