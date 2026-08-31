-- Let the household mark a favourite.
--
-- A pantry of 213 staples is a filing cabinet, not a shortlist. Everything in
-- it is something this family buys, so "regular buy" no longer distinguishes
-- anything -- what's missing is the handful they reach for most, which is what
-- you want at the top of a list you are scrolling in a shop.
--
-- Two columns because a pantry row has two possible homes: catalogue-backed
-- staples live in the household preference layer, and household-owned SKUs
-- (the branded products photographed off the shelf) live in products. Both are
-- shown in the same list, so both need the flag.
alter table household_product_preferences
  add column if not exists is_favourite boolean not null default false;

alter table products
  add column if not exists is_favourite boolean not null default false;

comment on column household_product_preferences.is_favourite is
  'Pinned to the top of Pantry and offered first on the list. Not the same as regular_buy, which by now covers almost everything.';

create index if not exists household_product_preferences_favourite_idx
  on household_product_preferences (household_id)
  where is_favourite;

create index if not exists products_favourite_idx
  on products (household_id)
  where is_favourite;
