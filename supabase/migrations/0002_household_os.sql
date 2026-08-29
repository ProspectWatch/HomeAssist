-- Household OS domain — Phase 1 design implementation.
--
-- Adds the schema needed for the approved Claude Design handoff
-- (design_handoff_household_os): grocery list, pantry/regular-buys,
-- departments, kids-sports athletes, a recipe library, receipts,
-- notifications, household settings, and richer watch-list fields
-- (status badge, regular/lowest price, "for whom").
--
-- Seed data policy (per the implementation brief): departments and
-- retailers below are seeded because they are structural taxonomy /
-- well-known real businesses, not household-specific facts. Nothing with
-- a household-specific price, quantity, purchase, or person's name is
-- seeded — those tables are created empty and stay empty until a real
-- household enters real data or a real scan/receipt writes to them.

-- ---------------------------------------------------------------------------
-- Departments — fixed navigation taxonomy for the "Your Home" grid and the
-- generic department screen. Global reference data, not household-scoped.
-- ---------------------------------------------------------------------------

create table departments (
  key text primary key,
  name text not null,
  hero_placeholder text not null,
  sort_order integer not null default 0
);

alter table departments enable row level security;

create policy "authenticated users can read departments"
  on departments for select
  to authenticated
  using (true);

insert into departments (key, name, hero_placeholder, sort_order) values
  ('kitchen', 'Kitchen + Pantry', 'Kitchen pantry photo', 0),
  ('sports', 'Kids Sports', 'Mudroom gear room photo', 1),
  ('hometech', 'Home Tech', 'Media room photo', 2),
  ('furniture', 'Furniture', 'Living room photo', 3),
  ('appliances', 'Appliances', 'Kitchen appliances photo', 4),
  ('bathrooms', 'Bathrooms', 'Bathroom vanity photo', 5),
  ('laundry', 'Laundry', 'Laundry room photo', 6),
  ('cleaning', 'Cleaning + Supplies', 'Cleaning supplies storage photo', 7),
  ('yard', 'Yard + Outdoor', 'Backyard patio photo', 8),
  ('decor', 'Decor', 'Decor styling photo', 9);

-- ---------------------------------------------------------------------------
-- Retailers — seed the well-known real chains the design references as
-- selectable options (store badges, preferred-store setting, recipe
-- ingredient sourcing). Real businesses, not household-specific data: no
-- distance/hours/pricing is stored here — those would be facts about a
-- specific household we don't have.
-- ---------------------------------------------------------------------------

insert into retailers (name, domain) values
  ('Costco', 'costco.ca'),
  ('No Frills', 'nofrills.ca'),
  ('Fortinos', 'fortinos.ca'),
  ('Food Basics', 'foodbasics.ca'),
  ('Farm Boy', 'farmboy.ca'),
  ('Home Depot', 'homedepot.ca'),
  ('Amazon', 'amazon.ca'),
  ('Marilu''s Market', 'marilus-market.example')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Extend products: department + "regular buy" fields, so the same table
-- backs the Pantry grid (department = kitchen) and every other
-- department's "Regular Buys" grid.
-- ---------------------------------------------------------------------------

alter table products
  add column department_key text references departments (key) on delete set null,
  add column room_id uuid references rooms (id) on delete set null,
  add column is_regular_buy boolean not null default false,
  add column package_detail text,
  add column target_price_cents integer check (target_price_cents is null or target_price_cents >= 0),
  add column stock_status text check (stock_status is null or stock_status in ('good', 'low'));

create index products_department_key_idx on products (department_key);

-- ---------------------------------------------------------------------------
-- Extend watch_items: badge status, regular price, "for whom" (athlete),
-- need-by date, notes. `status` (lifecycle: watching/paused/archived)
-- already existed; `price_status` is the separate design-driven badge.
-- ---------------------------------------------------------------------------

alter table watch_items
  add column price_status text not null default 'wait'
    check (price_status in ('wait', 'good_price', 'target_hit', 'all_time_low', 'price_dropped')),
  add column regular_price_cents integer check (regular_price_cents is null or regular_price_cents >= 0),
  add column needed_by date,
  add column notes text;

-- ---------------------------------------------------------------------------
-- Athletes — kids-sports tracker. Household-scoped, empty: real children's
-- names are household-specific data, never seeded.
-- ---------------------------------------------------------------------------

create table athletes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  sport text,
  created_at timestamptz not null default now()
);

create index athletes_household_id_idx on athletes (household_id);

alter table athletes enable row level security;

create policy "members can manage their household's athletes"
  on athletes for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

alter table watch_items
  add column athlete_id uuid references athletes (id) on delete set null;

create table athlete_equipment (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes (id) on delete cascade,
  equipment_type text not null,
  item text not null,
  created_at timestamptz not null default now()
);

create index athlete_equipment_athlete_id_idx on athlete_equipment (athlete_id);

alter table athlete_equipment enable row level security;

create policy "members can manage their household's athlete equipment"
  on athlete_equipment for all
  using (exists (
    select 1 from athletes
    where athletes.id = athlete_equipment.athlete_id
      and is_household_member(athletes.household_id)
  ))
  with check (exists (
    select 1 from athletes
    where athletes.id = athlete_equipment.athlete_id
      and is_household_member(athletes.household_id)
  ));

-- ---------------------------------------------------------------------------
-- Watch by spec — "not sure which exact product yet" watches.
-- ---------------------------------------------------------------------------

create table watch_specs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  brands text,
  requirements text,
  max_price_cents integer check (max_price_cents is null or max_price_cents >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index watch_specs_household_id_idx on watch_specs (household_id);

alter table watch_specs enable row level security;

create policy "members can manage their household's spec watches"
  on watch_specs for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Owned products — "Mark Purchased" moves a watch item here.
-- ---------------------------------------------------------------------------

create table owned_products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  name text not null,
  department_key text references departments (key) on delete set null,
  room_id uuid references rooms (id) on delete set null,
  retailer_id uuid references retailers (id) on delete set null,
  purchase_price_cents integer check (purchase_price_cents is null or purchase_price_cents >= 0),
  purchase_date date,
  warranty_until date,
  serial text,
  created_at timestamptz not null default now()
);

create index owned_products_household_id_idx on owned_products (household_id);

alter table owned_products enable row level security;

create policy "members can manage their household's owned products"
  on owned_products for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Grocery list
-- ---------------------------------------------------------------------------

create table grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  qty text,
  category text not null default 'Other'
    check (category in ('Meat', 'Dairy', 'Produce', 'Pantry', 'Frozen', 'Household', 'Other')),
  retailer_id uuid references retailers (id) on delete set null,
  checked boolean not null default false,
  has_deal boolean not null default false,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index grocery_items_household_id_idx on grocery_items (household_id);

alter table grocery_items enable row level security;

create policy "members can manage their household's grocery items"
  on grocery_items for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Recipes — a small starter reference library (generic recipe content: no
-- prices, no household-specific facts) so Recipes/Recipe Detail are real,
-- usable screens from day one. Global, not household-scoped.
-- ---------------------------------------------------------------------------

create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  time_minutes integer,
  servings text,
  created_at timestamptz not null default now()
);

alter table recipes enable row level security;

create policy "authenticated users can read recipes"
  on recipes for select
  to authenticated
  using (true);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  name text not null,
  qty text,
  usual_retailer_id uuid references retailers (id) on delete set null,
  sort_order integer not null default 0
);

create index recipe_ingredients_recipe_id_idx on recipe_ingredients (recipe_id);

alter table recipe_ingredients enable row level security;

create policy "authenticated users can read recipe ingredients"
  on recipe_ingredients for select
  to authenticated
  using (true);

do $$
declare
  r_id uuid;
begin
  -- Build a name -> id lookup for the retailers seeded above.
  create temporary table _retailer_lookup as select name, id from retailers;

  insert into recipes (name, time_minutes, servings) values
    ('Weeknight Chicken Stir-Fry', 30, 'Serves 4') returning id into r_id;
  insert into recipe_ingredients (recipe_id, name, qty, usual_retailer_id, sort_order) values
    (r_id, 'Chicken Breast', '2 lb', (select id from _retailer_lookup where name = 'Marilu''s Market'), 0),
    (r_id, 'Broccoli Crowns', '1 head', (select id from _retailer_lookup where name = 'Food Basics'), 1),
    (r_id, 'Soy Sauce', '1 bottle', (select id from _retailer_lookup where name = 'No Frills'), 2),
    (r_id, 'Jasmine Rice', '4 lb bag', (select id from _retailer_lookup where name = 'Costco'), 3),
    (r_id, 'Bell Peppers', '3', (select id from _retailer_lookup where name = 'Fortinos'), 4);

  insert into recipes (name, time_minutes, servings) values
    ('Taco Night', 25, 'Serves 5') returning id into r_id;
  insert into recipe_ingredients (recipe_id, name, qty, usual_retailer_id, sort_order) values
    (r_id, 'Ground Beef', '2 lb', (select id from _retailer_lookup where name = 'No Frills'), 0),
    (r_id, 'Taco Seasoning', '2 pkg', (select id from _retailer_lookup where name = 'No Frills'), 1),
    (r_id, 'Soft Flour Tortillas', '1 pkg', (select id from _retailer_lookup where name = 'Fortinos'), 2),
    (r_id, 'Shredded Tex-Mex Cheese', '1 bag', (select id from _retailer_lookup where name = 'Costco'), 3),
    (r_id, 'Salsa', '1 jar', (select id from _retailer_lookup where name = 'Food Basics'), 4);

  insert into recipes (name, time_minutes, servings) values
    ('Spaghetti & Meatballs', 35, 'Serves 4') returning id into r_id;
  insert into recipe_ingredients (recipe_id, name, qty, usual_retailer_id, sort_order) values
    (r_id, 'Spaghetti', '2 boxes', (select id from _retailer_lookup where name = 'Costco'), 0),
    (r_id, 'Marinara Sauce', '2 jars', (select id from _retailer_lookup where name = 'Fortinos'), 1),
    (r_id, 'Frozen Meatballs', '1 bag', (select id from _retailer_lookup where name = 'No Frills'), 2),
    (r_id, 'Parmesan Wedge', '1', (select id from _retailer_lookup where name = 'Costco'), 3);

  insert into recipes (name, time_minutes, servings) values
    ('Sheet-Pan Salmon & Veg', 30, 'Serves 4') returning id into r_id;
  insert into recipe_ingredients (recipe_id, name, qty, usual_retailer_id, sort_order) values
    (r_id, 'Salmon Fillets', '4', (select id from _retailer_lookup where name = 'Costco'), 0),
    (r_id, 'Asparagus', '1 bunch', (select id from _retailer_lookup where name = 'Food Basics'), 1),
    (r_id, 'Baby Potatoes', '2 lb bag', (select id from _retailer_lookup where name = 'No Frills'), 2),
    (r_id, 'Lemons', '3', (select id from _retailer_lookup where name = 'Fortinos'), 3);

  drop table _retailer_lookup;
end $$;

-- ---------------------------------------------------------------------------
-- Receipts — empty. Populated by "Scan Receipt" (not built yet) or manual
-- entry; never by seed data (that would be fabricated purchase history).
-- ---------------------------------------------------------------------------

create table receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  retailer_id uuid references retailers (id) on delete set null,
  purchased_at date not null default current_date,
  total_cents integer not null check (total_cents >= 0),
  image_url text,
  created_at timestamptz not null default now()
);

create index receipts_household_id_idx on receipts (household_id, purchased_at desc);

alter table receipts enable row level security;

create policy "members can manage their household's receipts"
  on receipts for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create table receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts (id) on delete cascade,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  product_id uuid references products (id) on delete set null
);

create index receipt_items_receipt_id_idx on receipt_items (receipt_id);

alter table receipt_items enable row level security;

create policy "members can manage their household's receipt items"
  on receipt_items for all
  using (exists (
    select 1 from receipts
    where receipts.id = receipt_items.receipt_id
      and is_household_member(receipts.household_id)
  ))
  with check (exists (
    select 1 from receipts
    where receipts.id = receipt_items.receipt_id
      and is_household_member(receipts.household_id)
  ));

-- ---------------------------------------------------------------------------
-- Notifications — empty. Written by the (future) scan pipeline / watch
-- price-check jobs, never seeded.
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  kind text not null check (kind in ('target_price_hit', 'price_drop', 'restock', 'regular_buy_deal')),
  title text not null,
  body text not null,
  watch_item_id uuid references watch_items (id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_household_id_idx on notifications (household_id, created_at desc);

alter table notifications enable row level security;

create policy "members can manage their household's notifications"
  on notifications for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Household settings — postal code / search radius / preferred store.
-- One row per household, created on demand (not seeded with any real
-- postal code — that would be a fabricated fact about the household).
-- ---------------------------------------------------------------------------

create table household_settings (
  household_id uuid primary key references households (id) on delete cascade,
  postal_code text,
  city text,
  search_radii_km jsonb not null default '{}'::jsonb,
  preferred_retailer_id uuid references retailers (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table household_settings enable row level security;

create policy "members can manage their household's settings"
  on household_settings for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));
