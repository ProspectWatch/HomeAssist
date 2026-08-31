-- Product photography, and the credit it legally requires.
--
-- The catalogue is generic by design ("Cheddar Cheese Block", "Broccoli"),
-- and Wikipedia's lead images are exactly that: one representative photo per
-- concept, freely licensed. Most are CC BY-SA, which permits this use and
-- requires attribution — so the attribution is stored next to the image
-- rather than being something to remember later.
--
-- A product with no image keeps null here and renders the category mark it
-- already had. Nothing is filled in speculatively: a wrong photo of the wrong
-- product is worse than an honest icon.
alter table catalog_products
  add column if not exists image_attribution text,
  add column if not exists image_license text,
  add column if not exists image_source_url text;

comment on column catalog_products.image_attribution is
  'Author/credit line required by the image licence. Displayed wherever the image is shown at size.';
comment on column catalog_products.image_license is
  'Short licence name, e.g. "CC BY-SA 4.0" or "Public domain".';
comment on column catalog_products.image_source_url is
  'The page the image came from, so the credit is verifiable.';
