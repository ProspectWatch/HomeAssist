-- One photograph, one product.
--
-- Image resolution matched several catalogue products to the same source, so
-- a single picture was standing in for a whole family: one mango photo served
-- Mangoes, Dried Mango, Frozen Mango and Mango Juice; one coconut-milk photo
-- served Cashew Milk. On a shelf those are different things, and showing the
-- same picture for all of them asserts something false — most visibly on deal
-- cards, where several brands of one product all rendered the same branded
-- bottle.
--
-- The rule: an image stays only on the product it actually depicts — the base
-- concept, the one every other sharer is a qualified form of ("Peaches" under
-- "Canned Peaches" and "Frozen Peaches"). Where no such product exists, the
-- picture describes none of them and is cleared from all: Red, White and
-- Yellow Onion are not interchangeable, and neither are Ribeye and Ground
-- Pork.
--
-- Cleared products fall back to the category mark the app already renders,
-- which claims nothing. 88 products lost an image here; all 88 were being
-- shown a picture of something else.
with stem as (
  select p.id, p.image_url,
    (select array_agg(distinct
        case when w ~ 'ies$' then regexp_replace(w,'ies$','y')
             when w ~ 'es$' and length(w) > 4 then regexp_replace(w,'es$','')
             when w ~ 's$' then regexp_replace(w,'s$','')
             else w end)
     from regexp_split_to_table(regexp_replace(lower(p.display_name),'[^a-z0-9]+',' ','g'),'\s+') w
     where length(w) > 2) as toks
  from catalog_products p
  where p.active and p.image_url is not null
),
shared as (select image_url from stem group by image_url having count(*) > 1),
to_clear as (
  select s.id
  from stem s
  join shared g on g.image_url = s.image_url
  where exists (
    select 1 from stem o
    where o.image_url = s.image_url and o.id <> s.id and not (o.toks @> s.toks)
  )
)
update catalog_products p
set image_url = null,
    image_ready = false,
    image_attribution = null,
    image_license = null,
    image_source_url = null
from to_clear c
where p.id = c.id;

-- Make the rule structural rather than a thing to remember. The cleanup above
-- is only true until the next bulk import reuses a URL, and that failure is
-- silent: nothing errors, the app just starts telling small lies about what
-- things look like. This turns it into a loud one at write time.
create unique index if not exists catalog_products_one_product_per_image
  on catalog_products (image_url)
  where image_url is not null and active;
