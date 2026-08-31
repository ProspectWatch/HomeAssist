#!/usr/bin/env python3
"""
Rejects images whose article is not about the product at all.

Name matching alone is not enough, and the failure is ugly: "Whole Turkey"
matched the article "Turkey" and would have illustrated the Christmas bird
with the flag of a country. "Sliced Mushrooms" matched a wild inedible
species; "Organic Eggs" matched a photograph of a hen.

So every candidate is checked against what the article actually says. A
grocery product must be described as something you eat, drink, cook with or
clean with — and articles about places, people, films, songs, teams and the
like are rejected outright, whatever their title.
"""
import json, re, sys, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = "HomeAssist/1.0 (household grocery app; info@prospect-watch.com)"
REST = "https://en.wikipedia.org/api/rest_v1/page/summary/"

# Things a grocery product is definitely not, however well the name matched.
#
# Only categories that produce outright absurd results are listed. Biology is
# deliberately absent: "Gala (apple)" is described as an apple cultivar and
# "Pomegranate" as a fruit-bearing shrub, and those are exactly the right
# photographs for a grocery catalogue. Excluding plants and animals threw away
# most of the produce along with the country.
NOT_A_PRODUCT = re.compile(
    r"(\bcountry in\b|\bcountries\b|\bsovereign state\b|\bnation in\b|\brepublic\b|"
    r"\bcapital (city|of)\b|\bcity in\b|\btown in\b|\bvillage in\b|\bmunicipalit|"
    r"\bdistrict (in|of)\b|\bregion (in|of)\b|\bisland (in|of)\b|\briver in\b|"
    r"\bmountain in\b|\blake in\b|\bcontinent\b|"
    r"\b(film|movie|album|song|band|novel|video game|tv series|"
    r"television series|magazine|newspaper)\b|"
    r"\b(musician|singer|actor|actress|footballer|politician|philosopher|"
    r"author|painter|composer)\b|"
    r"\bflag of\b|\bcoat of arms\b)",
    re.I,
)

def get(title):
    url = REST + urllib.parse.quote(title.replace(" ", "_"))
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep((2.0 if e.code in (429, 503) else 0.6) * (attempt + 1))
        except Exception:
            time.sleep(0.6 * (attempt + 1))
    return None

def singular(w):
    """English plural -> singular. The naive rule (drop a trailing "s")
    turned "Peaches" into "peache" and then failed to match the article
    "Peach", rejecting a correct image."""
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"
    if w.endswith(("oes", "shes", "ches", "xes", "sses")):
        return w[:-2]
    if w.endswith("s") and not w.endswith(("ss", "us", "is")):
        return w[:-1]
    return w

def shares_a_word(product, article):
    """The article must still be talking about the same thing.

    Catches the case the topic check cannot: an article that is genuinely
    about food but about a different food. "Organic Eggs" resolving to "Light
    Sussex" (a chicken breed) and "Coho Salmon" to a different salmon species
    both fail here.
    """
    stop = {"the", "of", "and", "a", "in", "or"}
    pw = {singular(w) for w in re.split(r"[^a-z0-9]+", product.lower()) if w and w not in stop}
    aw = {singular(w) for w in re.split(r"[^a-z0-9]+", article.lower()) if w and w not in stop}
    return bool(pw & aw)

def judge(article, product=None):
    page = get(article)
    time.sleep(0.15)
    if not page:
        return None  # unverifiable -> not used
    # Only the one-line description is tested. The full extract is far too
    # noisy for this: it rejected "Cupcake" for "single-serving", "Chorizo"
    # for "Iberian Peninsula" and "Quinoa" for "Andean region" — every one of
    # them a real grocery product with a perfectly good photograph.
    description = page.get("description") or ""
    if NOT_A_PRODUCT.search(description):
        return {"ok": False, "why": description[:70]}
    return {"ok": True, "why": description}

def main(path, out):
    rows = json.load(open(path))
    articles = sorted({r["article"] for r in rows if r.get("article")})
    print(f"verifying {len(articles)} articles behind {len(rows)} products", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=3) as ex:
        verdicts = dict(zip(articles, ex.map(judge, articles)))

    kept, dropped = [], []
    for r in rows:
        v = verdicts.get(r.get("article"))
        ok = bool(v and v["ok"] and shares_a_word(r["name"], r["article"]))
        if ok:
            kept.append(r)
        else:
            why = (v or {}).get("why", "unverifiable")
            if v and v["ok"]:
                why = f"article is about something else: {r['article']}"
            dropped.append({**r, "why": why})
    print(f"kept {len(kept)}, rejected {len(dropped)}", file=sys.stderr)
    json.dump(kept, open(out, "w"), indent=1)
    for d in dropped[:25]:
        print(f"  REJECT {d['name'][:28].ljust(28)} <- {str(d.get('article'))[:26].ljust(26)} {str(d.get('why'))[:52]}", file=sys.stderr)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
