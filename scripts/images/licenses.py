#!/usr/bin/env python3
"""
Fetches the licence and credit for each resolved image from Wikimedia Commons.

The image URL alone is not enough to use the picture: most Commons files are
CC BY-SA, which requires naming the author. This asks Commons for the real
licence and artist of each file rather than assuming one, and drops any image
whose licence cannot be established — an uncredited CC BY-SA image is a
licence breach, so no credit means no image.
"""
import html, json, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = "HomeAssist/1.0 (household grocery app; info@prospect-watch.com)"
API = "https://commons.wikimedia.org/w/api.php"

def filename(url):
    """Commons file name out of an upload.wikimedia.org URL."""
    path = urllib.parse.urlparse(url).path
    m = re.search(r"/commons/(?:thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/]+)", path)
    return urllib.parse.unquote(m.group(1)) if m else None

def strip_html(value):
    text = re.sub(r"<[^>]+>", "", value or "")
    return html.unescape(text).strip()

def fetch(names):
    params = {
        "action": "query", "format": "json", "prop": "imageinfo",
        "iiprop": "extmetadata|url", "iiextmetadatafilter": "LicenseShortName|Artist|Credit",
        "titles": "|".join(f"File:{n}" for n in names),
    }
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                 headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read())
        except Exception:
            time.sleep(0.5 * (attempt + 1))
    return {}

def main(inputs, out):
    rows = []
    for path in inputs:
        rows.extend(json.load(open(path)))
    hits = [r for r in rows if r.get("thumb")]
    by_file = {}
    for r in hits:
        f = filename(r["thumb"])
        if f:
            by_file.setdefault(f, []).append(r)

    names = list(by_file)
    print(f"{len(hits)} images, {len(names)} distinct files", file=sys.stderr)

    meta = {}
    batches = [names[i:i + 40] for i in range(0, len(names), 40)]
    def run(batch):
        data = fetch(batch)
        time.sleep(0.1)
        out = {}
        for page in (data.get("query", {}).get("pages", {}) or {}).values():
            title = page.get("title", "").removeprefix("File:")
            info = (page.get("imageinfo") or [{}])[0]
            em = info.get("extmetadata", {}) or {}
            lic = strip_html(em.get("LicenseShortName", {}).get("value", ""))
            artist = strip_html(em.get("Artist", {}).get("value", "")) or strip_html(
                em.get("Credit", {}).get("value", ""))
            if lic:
                out[title] = {
                    "license": lic,
                    "artist": (artist or "Wikimedia Commons")[:180],
                    "file_page": info.get("descriptionurl"),
                }
        return out
    with ThreadPoolExecutor(max_workers=4) as ex:
        for part in ex.map(run, batches):
            meta.update(part)

    resolved = []
    dropped = 0
    for f, items in by_file.items():
        m = meta.get(f)
        if not m:
            dropped += len(items)   # no verifiable licence -> no image
            continue
        for r in items:
            resolved.append({**r, **m})
    print(f"credited {len(resolved)}, dropped {dropped} with no verifiable licence", file=sys.stderr)
    json.dump(resolved, open(out, "w"), indent=1)

if __name__ == "__main__":
    main(sys.argv[1:-1], sys.argv[-1])
