-- Website prices, alongside flyer prices.
--
-- Direct retailer scraping is not available and is not being attempted: every
-- grocery site the household shops at refuses automated clients at the edge
-- (Loblaw banners return an Akamai 403, Food Basics a Cloudflare challenge,
-- walmart.ca a bot redirect, and Metro publishes empty product sitemaps).
-- Getting past those means impersonating a browser to defeat a bot control,
-- which is out of scope.
--
-- What is available is the aggregator's ecommerce feed, which carries real
-- online shelf prices — with SKUs and regular/sale prices — for a set of
-- retailers that overlaps only partly with the household's own stores.
--
-- Those two kinds of price are not interchangeable, hence `kind`:
--   STORE  — a physical store this household shops at. A flyer deal is only
--            useful if they actually go there, so flyer ingestion filters to
--            these.
--   ONLINE — a seller we can read a website price from. Delivery is not
--            bound to where you live, so online prices are NOT filtered by
--            where the household shops — but nor does listing one imply
--            this is somewhere they shop.
alter table retailers
  add column if not exists kind text not null default 'STORE'
    check (kind in ('STORE', 'ONLINE'));

comment on column retailers.kind is
  'STORE = physical store the household shops at (flyer sources). ONLINE = website price source, buyable regardless of location.';

-- The retailers whose website prices the ecommerce feed actually carries for
-- this household's region. Added as ONLINE so they never silently join the
-- household's curated list of stores it shops at.
--
-- Walmart and Shoppers Drug Mart do have physical stores; they are ONLINE here
-- because that is the capacity in which this app can read their prices, not a
-- claim about whether the household visits them.
-- name and domain are both UNIQUE, so this is safely re-runnable.
insert into retailers (name, domain, kind, scan_enabled)
values
  ('Walmart',            'walmart.ca',      'ONLINE', true),
  ('Shoppers Drug Mart', 'shoppersdrugmart.ca', 'ONLINE', true),
  ('London Drugs',       'londondrugs.com', 'ONLINE', true),
  ('Well.ca',            'well.ca',         'ONLINE', true),
  ('Healthy Planet',     'healthyplanetcanada.com', 'ONLINE', true)
on conflict (name) do nothing;
