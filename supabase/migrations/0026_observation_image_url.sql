-- The flyer and the retailer's website both ship a picture of the thing on
-- offer, and we were throwing it away.
--
-- The catalogue's own photograph is still preferred: it is a clean, generic
-- product shot chosen for the concept. But roughly two thirds of the
-- catalogue has no image yet, and for those a deal card was rendering a
-- placeholder while the flyer that produced it had a perfectly good picture
-- attached. This keeps that picture so it can stand in.
alter table retailer_price_observations
  add column if not exists image_url text;

comment on column retailer_price_observations.image_url is
  'Product image from the flyer or retailer listing. Fallback for deal cards when the catalogue product has no image of its own.';
