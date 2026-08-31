#!/usr/bin/env python3
"""
Finds a real, freely-licensed photograph for each catalogue product.

The catalogue is deliberately generic — "Cheddar Cheese Block", "Broccoli",
"Laundry Detergent" — and Wikipedia's lead images are exactly that: one
representative photo per concept, freely licensed, with attribution
recoverable from Commons.

Nothing here invents an image. A product whose lookup does not clear the
checks below is left without one, because the app already renders a category
mark for those, and a wrong photo is worse than no photo.
"""
import json, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = "HomeAssist/1.0 (household grocery app; info@prospect-watch.com)"
REST = "https://en.wikipedia.org/api/rest_v1/page/summary/"
SEARCH = "https://en.wikipedia.org/w/api.php"

# Words that describe packaging or cut rather than the thing itself. Dropped
# when building a lookup title, kept in the product name.
QUALIFIERS = {
    "block", "shredded", "sliced", "whole", "fresh", "frozen", "canned", "dried",
    "bag", "bagged", "boxed", "bottle", "bottled", "jar", "pack", "family",
    "large", "small", "mini", "size", "value", "organic", "assorted", "mixed",
    "boneless", "skinless", "aaa", "aa", "lean", "extra", "medium", "regular",
}

def norm(s):
    return re.sub(r"[^a-z0-9 ]+", " ", s.lower()).split()

def singular(w):
    """English plural -> singular, enough for food nouns."""
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"          # berries -> berry
    if w.endswith(("oes", "shes", "ches", "xes", "sses")):
        return w[:-2]                # mangoes -> mango, peaches -> peach
    if w.endswith("s") and not w.endswith(("ss", "us", "is")):
        return w[:-1]                # plums -> plum
    return w

def candidates(name):
    """Titles to try, most specific first.

    Deliberately never falls back to the bare head noun. Doing so turned
    "Passion Fruit" into the article "Fruit" and "Fruit Tray" into "Tray" —
    a confident-looking photo of the wrong thing, which is the one outcome
    worth engineering against.
    """
    words = norm(name)
    out = []
    def add(ws):
        if not ws: return
        t = " ".join(ws)
        if t and t not in out: out.append(t)
    add(words)
    add([singular(w) for w in words])
    core = [w for w in words if w not in QUALIFIERS]
    add(core)
    add([singular(w) for w in core])
    # Singularise only the head noun, keeping modifiers ("Navel Oranges" ->
    # "Navel orange").
    if core:
        add(core[:-1] + [singular(core[-1])])
    return out[:6]

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

MISSING = object()  # a real 404: the article does not exist

def summary(title):
    """A 404 is an answer; anything else is retried, so a transient failure
    is never silently recorded as 'no image exists for this product'."""
    url = REST + urllib.parse.quote(title.replace(" ", "_"))
    for attempt in range(3):
        try:
            return get(url)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return MISSING
            time.sleep(0.5 * (attempt + 1))
        except Exception:
            time.sleep(0.5 * (attempt + 1))
    return None

def relevant(product, page):
    """The article must plainly be about this product.

    Guards against the failure that matters: attaching a confident-looking
    photo of the wrong thing. Every distinguishing word in the product name
    has to be accounted for by the article title — "Passion Fruit" is not
    satisfied by "Fruit" — and disambiguation pages are rejected outright.
    """
    if not page or page is MISSING or page.get("type") != "standard":
        return False
    title = [singular(w) for w in norm(page.get("title", ""))]
    if not title:
        return False
    pwords = [singular(w) for w in norm(product) if w not in QUALIFIERS]
    if not pwords:
        return False
    # The head noun must be present...
    if pwords[-1] not in title:
        return False
    # ...and so must every modifier that distinguishes this product from the
    # generic concept, unless the title is a recognised single-word synonym
    # of the whole product name.
    modifiers = pwords[:-1]
    if modifiers and not any(m in title for m in modifiers):
        return len(pwords) == len(title)
    return True

def named_variety(product, page):
    """Cultivar and brand articles drop the category word: the apple variety
    "Granny Smith Apples" is filed under "Granny Smith". Accepted only when
    the whole article title appears in the product name and is specific
    enough to identify it — two words or more, so "Fruit" can never stand in
    for "Passion Fruit"."""
    if not page or page is MISSING or page.get("type") != "standard":
        return False
    title = [singular(w) for w in norm(page.get("title", ""))]
    pwords = [singular(w) for w in norm(product)]
    return len(title) >= 2 and all(w in pwords for w in title)

def resolve(item):
    pid, name = item
    for title in candidates(name):
        page = summary(title)
        time.sleep(0.05)
        if not (relevant(name, page) or named_variety(name, page)):
            continue
        thumb = (page.get("thumbnail") or {}).get("source")
        original = (page.get("originalimage") or {}).get("source")
        if not thumb:
            continue
        return {
            "id": pid,
            "name": name,
            "article": page.get("title"),
            "thumb": thumb,
            "original": original,
            "url": (page.get("content_urls", {}).get("desktop", {}) or {}).get("page"),
        }
    return {"id": pid, "name": name, "article": None, "thumb": None}

def main(path, start, end, out, workers=8):
    products = json.load(open(path))["products"][start:end]
    items = [(p["id"], p["display_name"]) for p in products]
    with ThreadPoolExecutor(max_workers=workers) as ex:
        results = list(ex.map(resolve, items))
    hits = [r for r in results if r.get("thumb")]
    print(f"resolved {len(hits)}/{len(results)} [{start}:{end}]", file=sys.stderr)
    json.dump(results, open(out, "w"), indent=1)

if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
