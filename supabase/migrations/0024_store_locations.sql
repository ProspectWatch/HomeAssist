-- Real store locations, from OpenStreetMap.
--
-- retailer_locations has been empty since it was created, which is why the
-- app can say what a thing costs but never where to go. These are real
-- branches with real coordinates, looked up by retailer name and city.
--
-- The household's postal code was never sent to the geocoder; the city is
-- enough to find the right branches. OSM maps a single supermarket as several
-- objects -- building, entrance, car park -- so records within 250 m of one
-- another are collapsed into the one store they describe.
--
-- distance_km and drive_time_minutes stay null. Those need the household's
-- own position and a routing service, and an estimate dressed as a measured
-- distance is exactly what this table's original comment forbids.
insert into retailer_locations
  (retailer_id, external_location_id, name, address, city, province, postal_code,
   latitude, longitude, source, last_verified_at)
select r.id, v.external_id, v.name, v.address, v.city, v.province, v.postal_code,
       v.latitude, v.longitude, 'openstreetmap', now()
from (values
  ('Fortinos','osm:w462892945','Fortinos — Bird Boulevard','Bird Boulevard','Burlington','Ontario','L7L 0G2',43.4070804,-79.8043941),
  ('Fortinos','osm:w198834232','Fortinos — 1059 Plains Road East','1059 Plains Road East','Burlington','Ontario','L7T 4K1',43.326575,-79.8315541),
  ('Fortinos','osm:n276091459','Fortinos — Guelph Line','Guelph Line','Burlington','Ontario','L7P 4M8',43.3666024,-79.8226891),
  ('Fortinos','osm:n2707148173','Fortinos — Timber Lane','Timber Lane','Burlington','Ontario','L7L 1V1',43.3698466,-79.7533374),
  ('No Frills','osm:n455060781','No Frills — 571 Brant Street','571 Brant Street','Burlington','Ontario','L7R 2G6',43.3296239,-79.8018831),
  ('No Frills','osm:n288341867','No Frills — Coventry Way','Coventry Way','Burlington','Ontario','L7P 4M7',43.3739726,-79.8367727),
  ('Food Basics','osm:n419372344','Food Basics — Hampton Heath Road','Hampton Heath Road','Burlington','Ontario','L7L 1C7',43.368534,-79.7315328),
  ('Food Basics','osm:n419364696','Food Basics — Fairview Street','Fairview Street','Burlington','Ontario','L7N 3L5',43.3554901,-79.7849809),
  ('Food Basics','osm:n288064679','Food Basics — Guelph Line','Guelph Line','Burlington','Ontario','L7P 3B6',43.3639967,-79.8194313),
  ('Costco','osm:w25482158','Costco — 1225 Brant Street','1225 Brant Street','Burlington','Ontario','L7P 1X7',43.3443413,-79.821387),
  ('Farm Boy','osm:n7060850400','Farm Boy — Walkers Line','Walkers Line','Burlington','Ontario','L7M 0W3',43.3934668,-79.8247607),
  ('Farm Boy','osm:n7061164007','Farm Boy — 3230 Fairview Street','3230 Fairview Street','Burlington','Ontario','L7N 3H5',43.3518338,-79.7886164),
  ('Marilu''s Market','osm:n1713655329','Marilu''s Market — 4025 New Street','4025 New Street','Burlington','Ontario','L7L 1S8',43.3539743,-79.7694457)
) as v(retailer_name, external_id, name, address, city, province, postal_code, latitude, longitude)
join retailers r on r.name = v.retailer_name
on conflict (retailer_id, external_location_id) do nothing;
