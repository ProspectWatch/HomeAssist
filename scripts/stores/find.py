#!/usr/bin/env python3
"""
Finds the household's real store locations from OpenStreetMap.

`retailer_locations` has been empty since it was created, which is why
nothing in the app can say where to shop, only what a thing costs. This fills
it from OSM's Nominatim service — real, openly-licensed location data with
addresses and coordinates.

Only the retailer name and the city are ever sent. The household's postal
code is not: the city is enough to find the right branches, and their exact
address is nobody else's business.

Nothing is invented. A retailer with no result gets no row, and no
coordinates are ever estimated.
"""
import json, sys, time, urllib.parse, urllib.request

UA = "HomeAssist/1.0 (household grocery app; info@prospect-watch.com)"
ENDPOINT = "https://nominatim.openstreetmap.org/search"

def search(term, limit=6):
    url = f"{ENDPOINT}?{urllib.parse.urlencode({'q': term, 'format': 'json', 'limit': limit, 'addressdetails': 1})}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read())
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return []

def main(city, retailers):
    out = []
    for name in retailers:
        results = search(f"{name} {city}")
        # Nominatim's usage policy asks for at most one request a second.
        time.sleep(1.2)
        for r in results:
            addr = r.get("address", {})
            # Must actually be the retailer, in the right city, with a real
            # position. Anything else is dropped rather than guessed at.
            label = (r.get("display_name") or "")
            if name.split()[0].lower() not in label.lower():
                continue
            city_name = addr.get("city") or addr.get("town") or addr.get("municipality") or ""
            if city.split(",")[0].lower() not in city_name.lower():
                continue
            street = " ".join(x for x in [addr.get("house_number"), addr.get("road")] if x)
            out.append({
                "retailer": name,
                "external_id": f"osm:{r.get('osm_type','')[0:1]}{r.get('osm_id')}",
                "name": f"{name} — {street or addr.get('suburb') or city_name}",
                "address": street or None,
                "city": city_name or None,
                "province": addr.get("state") or None,
                "postal_code": addr.get("postcode") or None,
                "lat": float(r["lat"]),
                "lon": float(r["lon"]),
            })
        print(f"{name}: {sum(1 for o in out if o['retailer']==name)} found", file=sys.stderr)
    json.dump(out, open("scripts/stores/locations.json", "w"), indent=1)
    print(f"total {len(out)}", file=sys.stderr)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
