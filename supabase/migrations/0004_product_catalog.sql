-- Phase 2B — Product library.
--
-- Adds a global, reusable household-product dictionary (catalog_products)
-- that powers fast typeahead search across Grocery List, Pantry, Watch,
-- Recipes, and category browsing — separate from the existing `products`
-- table, which stays what it already was: a *household's own* tracked
-- SKUs (a specific watched/regular-buy item, optionally at a specific
-- retailer). catalog_products is the shared dictionary a household's
-- products can optionally point at; it is never itself household-scoped.
--
-- Seed data policy (same rule 0002 already established): the taxonomy
-- (product_categories/product_subcategories) and the imported catalogue
-- itself are structural/reference data, not household-specific facts, so
-- they may be seeded. Nothing household-specific (a preference row tied
-- to a real household_id) is seeded here — see seed_starter_household_preferences()
-- below, which a household calls for itself once it exists; Phase 1's
-- "no auth/onboarding yet" note still holds, so no household row exists
-- to attach real preference data to today.

create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Taxonomy — small, flat lookup tables purely for category-browsing order
-- and integrity. Deliberately not over-normalized: catalog_products keeps
-- category/subcategory as plain text (FK-checked against these tables)
-- rather than joining through surrogate ids for every read.
-- ---------------------------------------------------------------------------

create table product_categories (
  name text primary key,
  sort_order integer not null default 0
);

alter table product_categories enable row level security;

create policy "authenticated users can read product categories"
  on product_categories for select
  to authenticated
  using (true);

insert into product_categories (name, sort_order) values
  ('Produce', 0),
  ('Meat & Seafood', 1),
  ('Dairy & Eggs', 2),
  ('Pantry', 3),
  ('Frozen', 4),
  ('Deli & Prepared', 5),
  ('Drinks', 6),
  ('Household', 7)
on conflict (name) do nothing;

create table product_subcategories (
  category text not null references product_categories (name) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  primary key (category, name)
);

alter table product_subcategories enable row level security;

create policy "authenticated users can read product subcategories"
  on product_subcategories for select
  to authenticated
  using (true);

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
  ('Frozen', 'Frozen Meals', 0),
  ('Frozen', 'Frozen Meat', 1),
  ('Frozen', 'Frozen Sides', 2),
  ('Frozen', 'Frozen Vegetables', 3),
  ('Frozen', 'Frozen Dessert', 4),
  ('Deli & Prepared', 'Deli', 0),
  ('Deli & Prepared', 'Prepared Meals', 1),
  ('Drinks', 'Juice', 0),
  ('Drinks', 'Kids Drinks', 1),
  ('Drinks', 'Tea', 2),
  ('Drinks', 'Water', 3),
  ('Drinks', 'Coffee', 4),
  ('Household', 'Laundry', 0),
  ('Household', 'Dishwashing', 1),
  ('Household', 'Cleaning', 2),
  ('Household', 'Paper', 3),
  ('Household', 'Waste', 4),
  ('Household', 'Storage', 5),
  ('Household', 'Personal Care', 6),
  ('Household', 'Pet', 7),
  ('Household', 'Home Supplies', 8)
on conflict (category, name) do nothing;

-- ---------------------------------------------------------------------------
-- Catalog products — the generic, reusable dictionary. Global reference
-- data (like `retailers`/`recipes`): readable by every authenticated user,
-- written only by the (service-role) importer, never household-scoped.
-- ---------------------------------------------------------------------------

create table catalog_products (
  id text primary key,
  normalized_name text not null,
  display_name text not null,
  brand text,
  category text not null references product_categories (name),
  subcategory text,
  search_aliases text[] not null default '{}',
  default_unit text,
  image_url text,
  image_ready boolean not null default false,
  source text not null default 'manual',
  source_notes text,
  preferred_store_hint text,
  preferred_retailer_id uuid references retailers (id) on delete set null,
  active boolean not null default true,
  -- Set once a person hand-edits a row in the app; the importer must then
  -- skip overwriting that row on future catalogue re-imports (step 12).
  manually_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category, subcategory) references product_subcategories (category, name),
  constraint catalog_products_subcategory_requires_value check (subcategory is null or length(subcategory) > 0)
);

-- Full search surface (name + brand + aliases + category/subcategory),
-- lowercased with punctuation stripped so "Earth's Own" matches "earths own"
-- and "Bi-Colour Corn" matches "bi colour corn". Trigram-indexed so ILIKE
-- '%term%' and similarity() both use the index — plenty for a few hundred
-- rows. The app additionally caches the whole catalogue client-side for
-- instant typeahead (step 11); this index backs the server-side search
-- function and keeps room to grow past a client-cacheable size later.
--
-- A plain column kept in sync by a trigger, not a GENERATED column: under
-- this database's (nondeterministic/ICU) default collation, Postgres
-- refuses to treat lower()/regexp_replace() as immutable enough for a
-- generated-column expression, even though the wrapping function is
-- declared immutable. A trigger has no such restriction.
create or replace function product_search_normalize(input text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

alter table catalog_products add column search_text text not null default '';

create or replace function catalog_products_set_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := product_search_normalize(
    new.display_name || ' ' || coalesce(new.brand, '') || ' ' ||
    array_to_string(new.search_aliases, ' ') || ' ' ||
    new.category || ' ' || coalesce(new.subcategory, '')
  );
  return new;
end;
$$;

create trigger catalog_products_search_text_trigger
  before insert or update on catalog_products
  for each row execute function catalog_products_set_search_text();

create index catalog_products_search_text_trgm_idx on catalog_products using gin (search_text gin_trgm_ops);
create index catalog_products_category_idx on catalog_products (category, subcategory);
create index catalog_products_active_idx on catalog_products (active);
create index catalog_products_normalized_name_idx on catalog_products (normalized_name);

alter table catalog_products enable row level security;

create policy "authenticated users can read catalog products"
  on catalog_products for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Link the existing household-scoped tables to the generic catalogue.
-- Nullable everywhere: a household item can still be a free-text/custom
-- entry with no catalogue match (step 4's "don't force the catalogue match").
-- ---------------------------------------------------------------------------

alter table products
  add column catalog_product_id text references catalog_products (id) on delete set null;

alter table grocery_items
  add column catalog_product_id text references catalog_products (id) on delete set null;

alter table recipe_ingredients
  add column catalog_product_id text references catalog_products (id) on delete set null;

create index products_catalog_product_id_idx on products (catalog_product_id);
create index grocery_items_catalog_product_id_idx on grocery_items (catalog_product_id);
create index recipe_ingredients_catalog_product_id_idx on recipe_ingredients (catalog_product_id);

-- ---------------------------------------------------------------------------
-- Household product preferences — the layer that distinguishes a generic
-- need ("milk") from this household's actual preferred SKU (step 7/8).
-- A preference can attach at product, subcategory, or category scope, so
-- "Pork -> Fortinos" doesn't require one row per pork cut.
-- ---------------------------------------------------------------------------

create table household_product_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  scope_type text not null check (scope_type in ('category', 'subcategory', 'product')),
  -- category name, subcategory name, or catalog_products.id, depending on scope_type
  scope_key text not null,
  label text not null,
  preferred_brand text,
  preferred_variant text,
  preferred_size text,
  preferred_store text,
  preferred_retailer_id uuid references retailers (id) on delete set null,
  acceptable_brands text[] not null default '{}',
  acceptable_stores text[] not null default '{}',
  brand_rigidity text not null default 'FLEXIBLE'
    check (brand_rigidity in ('EXACT_ONLY', 'PREFERRED', 'FLEXIBLE')),
  typical_quantity text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, scope_type, scope_key)
);

create index household_product_preferences_household_id_idx on household_product_preferences (household_id);

alter table household_product_preferences enable row level security;

create policy "members can manage their household's product preferences"
  on household_product_preferences for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Starter preferences for the Brown family (step 7 of the Phase 2B brief).
-- Idempotent (on conflict do nothing) and safe to call any time after both
-- the household and the catalogue import exist — nothing calls this
-- automatically, since no household/auth flow exists yet (Phase 1 note in
-- lib/supabase/household.ts still holds). Wire it into onboarding once
-- real sign-up exists, or call it once by hand for the Browns' household.
create or replace function seed_starter_household_preferences(target_household_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  insert into household_product_preferences
    (household_id, scope_type, scope_key, label, preferred_brand, preferred_variant, preferred_store, preferred_retailer_id, acceptable_brands, notes)
  values
    (target_household_id, 'category', 'Produce', 'Produce', null, null, 'Marilu''s Market',
     (select id from retailers where name = 'Marilu''s Market'), '{}', null),
    (target_household_id, 'product', 'boneless-skinless-chicken-breast', 'Chicken Breast', null, null, 'Marilu''s Market',
     (select id from retailers where name = 'Marilu''s Market'), '{}', null),
    (target_household_id, 'product', 'aaa-striploin-steak', 'Striploin Steak', null, 'Striploin or New York Strip', 'Marilu''s Market',
     (select id from retailers where name = 'Marilu''s Market'), '{}', 'Preferred cuts: striploin, New York strip.'),
    (target_household_id, 'product', 'ribeye-steak', 'Ribeye Steak', null, null, 'Marilu''s Market',
     (select id from retailers where name = 'Marilu''s Market'), '{}', null),
    (target_household_id, 'product', 'sirloin-steak', 'Sirloin Steak', null, null, 'Marilu''s Market',
     (select id from retailers where name = 'Marilu''s Market'), '{}', null),
    (target_household_id, 'product', 'beef-tenderloin', 'Beef Tenderloin', null, null, 'Marilu''s Market',
     (select id from retailers where name = 'Marilu''s Market'), '{}', null),
    (target_household_id, 'subcategory', 'Pork', 'Pork', null, null, 'Fortinos',
     (select id from retailers where name = 'Fortinos'), '{}', null),
    (target_household_id, 'product', 'fast-fry-beef', 'Fast-Fry Beef', null, null, 'Fortinos',
     (select id from retailers where name = 'Fortinos'), '{}', null),
    (target_household_id, 'product', 'earth-s-own-original-almond-milk', 'Almond Milk', 'Earth''s Own', 'Original', null,
     null, '{}', null),
    (target_household_id, 'subcategory', 'Milk', 'Milk', null, '2% or Lactose-Free', null,
     null, array['Lactantia', 'Neilson'], null),
    (target_household_id, 'subcategory', 'Eggs', 'Eggs', 'Conestoga', 'Brown, Free-Range', 'Food Basics',
     (select id from retailers where name = 'Food Basics'), '{}', null),
    (target_household_id, 'product', 'shredded-tex-mex-cheese', 'Shredded Cheese', null, 'Tex-Mex', null,
     null, '{}', null)
  on conflict (household_id, scope_type, scope_key) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Product alternatives — data contract only (step 9). No auto-substitution
-- logic and no seeded rows; this just gives the future deal-scanning
-- pipeline somewhere to write match-quality relationships between two
-- catalogue products. Service-role only, like scan_jobs.
-- ---------------------------------------------------------------------------

create table product_alternatives (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references catalog_products (id) on delete cascade,
  alternative_product_id text not null references catalog_products (id) on delete cascade,
  match_quality text not null check (match_quality in ('EXACT', 'VERY_CLOSE', 'ACCEPTABLE', 'LAST_RESORT')),
  notes text,
  created_at timestamptz not null default now(),
  check (product_id <> alternative_product_id),
  unique (product_id, alternative_product_id)
);

create index product_alternatives_product_id_idx on product_alternatives (product_id);

alter table product_alternatives enable row level security;

create policy "authenticated users can read product alternatives"
  on product_alternatives for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Storage — product-images bucket. Public read (these are generic product
-- photos, not household data); writes are service-role only (the image
-- upload script), matching the read-only-to-clients pattern used for
-- retailers/departments/recipes above.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "public can read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');
