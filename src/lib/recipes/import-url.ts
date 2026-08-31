/**
 * Reading a recipe out of a web page.
 *
 * Almost every recipe site publishes schema.org/Recipe as JSON-LD in the head,
 * because that is what puts the little photo and the cook time into a search
 * result. That makes this a parsing problem rather than a guessing one: the
 * ingredients come from the page's own machine-readable copy of them, not from
 * an interpretation of its prose.
 *
 * When a page has no JSON-LD, this fails and says so. The alternative — an
 * approximate reading of the visible text — produces an ingredient list that
 * looks complete and quietly isn't, and a recipe missing one ingredient is
 * discovered at the stove.
 */

import { decodeEntities } from "@/lib/recipes/ingredient-match";

export type ImportedRecipe = {
  name: string;
  timeMinutes: number | null;
  servings: string | null;
  ingredients: string[];
  sourceUrl: string;
};

export type ImportResult =
  | { ok: true; recipe: ImportedRecipe }
  | { ok: false; message: string };

/**
 * Hosts and addresses a server must never be talked into fetching.
 *
 * The URL comes from whoever is typing, and this fetch runs server-side with
 * whatever network position the server has. Without this, "import a recipe"
 * is a request to fetch an arbitrary address from inside the deployment —
 * including cloud metadata endpoints, which is how credentials leak.
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
]);

function isPrivateV4(host: string): boolean {
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  return false;
}

/**
 * The v4 address inside an IPv4-mapped IPv6 one, or null.
 *
 * `::ffff:127.0.0.1` and `::ffff:7f00:1` are both loopback wearing a different
 * hat, and the second is what a URL parser normalises the first into — so a
 * guard that only reads dotted quads waves it straight through. This was a real
 * hole here before it was a comment.
 */
function mappedV4(host: string): string | null {
  const dotted = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) return dotted[1];
  const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function isPrivateAddress(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  // Loopback, unspecified, unique-local and link-local IPv6.
  if (host === "::1" || host === "::" || /^f[cd]/.test(host) || host.startsWith("fe80")) {
    return true;
  }
  const mapped = mappedV4(host);
  if (mapped) return isPrivateV4(mapped);
  return isPrivateV4(host);
}

export function checkRecipeUrl(raw: string): { ok: true; url: URL } | { ok: false; message: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, message: "That doesn't look like a link. Paste the whole address." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, message: "Only web links can be imported." };
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".local") || isPrivateAddress(host)) {
    return { ok: false, message: "That address can't be reached from here." };
  }
  return { ok: true, url };
}

/** Every JSON-LD block in a document, parsed and flattened. */
export function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      // A page may publish one object, an array, or a @graph wrapper.
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else if (parsed && typeof parsed === "object" && "@graph" in parsed) {
        const graph = (parsed as { "@graph": unknown })["@graph"];
        if (Array.isArray(graph)) blocks.push(...graph);
        else blocks.push(parsed);
      } else blocks.push(parsed);
    } catch {
      // One malformed block should not lose the others.
    }
  }
  return blocks;
}

function isRecipeNode(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const type = (node as Record<string, unknown>)["@type"];
  if (typeof type === "string") return type.toLowerCase() === "recipe";
  if (Array.isArray(type)) return type.some((t) => String(t).toLowerCase() === "recipe");
  return false;
}

/**
 * ISO 8601 duration to whole minutes. "PT1H15M" -> 75.
 *
 * Days are counted because some sites express an overnight prove that way, and
 * silently dropping the day would turn 24 hours into ten minutes.
 */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:[\d.]+S)?)?$/i);
  if (!m) return null;
  const [, d, h, min] = m;
  const total = Number(d ?? 0) * 1440 + Number(h ?? 0) * 60 + Number(min ?? 0);
  return total > 0 ? total : null;
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(textOf).filter((v): v is string => !!v);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (value && typeof value === "object" && "name" in value) {
    return textOf((value as { name: unknown }).name);
  }
  return null;
}

function ingredientList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const text = textOf(entry);
    if (!text) continue;
    // Collapse the whitespace and non-breaking spaces recipe sites are full of,
    // and decode the HTML entities that survive JSON-LD — a real imported
    // line read "Portugal&#39;s yellow potatoes" until this was added.
    const clean = decodeEntities(text).replace(/ /g, " ").replace(/\s+/g, " ").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

/**
 * Pulls the recipe out of a page's structured data.
 *
 * `totalTime` is preferred over `cookTime`, because the question the planner
 * asks is "can this be on the table in half an hour", and that includes the
 * chopping.
 */
export function parseRecipeFromHtml(html: string, sourceUrl: string): ImportResult {
  const node = extractJsonLd(html).find(isRecipeNode);
  if (!node) {
    return {
      ok: false,
      message: "That page doesn't publish its recipe in a readable format. Add it by hand, or send a screenshot.",
    };
  }

  const name = textOf(node.name);
  if (!name) {
    return { ok: false, message: "That page has a recipe but no name for it." };
  }

  const ingredients = ingredientList(node.recipeIngredient ?? node.ingredients);
  if (ingredients.length === 0) {
    // A recipe with a name and no ingredients is worse than no import at all:
    // it looks like it worked.
    return { ok: false, message: `Found "${name}" but no ingredient list on that page.` };
  }

  return {
    ok: true,
    recipe: {
      name,
      timeMinutes:
        parseIsoDuration(node.totalTime) ??
        parseIsoDuration(node.cookTime) ??
        parseIsoDuration(node.prepTime),
      servings: textOf(node.recipeYield),
      ingredients,
      sourceUrl,
    },
  };
}
