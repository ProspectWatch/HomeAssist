-- Which flavour we want, per line on the shopping list.
--
-- Deals are matched on brand, not flavour: a Doritos offer is a Doritos offer
-- whether the bag is Nacho Cheese or Sweet Chili Heat. But the person standing
-- in front of the shelf has to pick one, and the household knows which ones it
-- actually eats. So the choice lives on the list line rather than on the deal.
--
-- An array because a trip often wants more than one — the Doritos deal is two
-- bags, one of each. Empty is the normal state: most items have no flavour
-- worth stating.
--
-- Deliberately not written back to household_product_preferences.preferred_variant:
-- picking Sweet Chili Heat this week is a choice for this week, not a standing
-- preference, and promoting it to one would put a wrong "Preferred" label on
-- every future list.
alter table public.grocery_items
  add column if not exists variants text[] not null default '{}'::text[];

comment on column public.grocery_items.variants is
  'Flavours/variants chosen for this line, e.g. {"Nacho Cheese","Sweet Chili Heat"}. Per-trip, not a standing preference.';
