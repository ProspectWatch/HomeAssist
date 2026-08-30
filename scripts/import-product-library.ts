/**
 * Idempotent importer for a HomeAssist Product Library export (the
 * products.csv this package ships with) into the `catalog_products` table.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *     npx tsx scripts/import-product-library.ts path/to/products.csv
 *
 * Safe to run repeatedly against the same or a refreshed export:
 *  - rows are upserted by their stable `id` (the csv's normalized slug);
 *  - a catalog_products row flagged `manually_edited` (set by hand in the
 *    app, e.g. via Studio) is never overwritten by a re-import — step 12.
 *  - the two known duplicate ids in the v1 package (english-cucumber,
 *    green-onion, each listed once under a real subcategory and once under
 *    "Scraped Store Example") are merged into a single row rather than
 *    failing on the primary-key collision.
 *  - remaining "Scraped Store Example" rows (no real-subcategory duplicate)
 *    are remapped to a real subcategory so category browsing never shows
 *    that sourcing label as if it were a taxonomy value.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

type CsvRow = {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  brand: string;
  search_aliases: string;
  default_unit: string;
  preferred_store: string;
  image_path: string;
  image_ready: string;
  notes: string;
};

// Ids whose only row is "Scraped Store Example" — remap to the real
// subcategory they actually belong in so category browsing stays clean.
const SCRAPED_SUBCATEGORY_FIX: Record<string, string> = {
  "romaine-hearts-3-pack": "Leafy Greens",
  "green-seedless-grapes": "Fruit",
  "bananas-bunch": "Fruit",
  "bi-colour-corn-on-the-cob": "Vegetables",
  "yellow-onions-3-lb-bag": "Vegetables",
  "neilson-2-milk-4-l": "Milk",
  "neilson-2-milk-2-l": "Milk",
};

// Short preferred_store hints in the export vs. this app's seeded retailer names.
const RETAILER_NAME_ALIASES: Record<string, string> = {
  "Marilu's": "Marilu's Market",
};

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {} as CsvRow;
    header.forEach((key, i) => {
      (row as unknown as Record<string, string>)[key] = cells[i] ?? "";
    });
    return row;
  });
}

// Minimal CSV split that honors double-quoted fields (the export quotes
// any field containing a comma, e.g. search_aliases).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type CatalogRow = {
  id: string;
  normalized_name: string;
  display_name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  search_aliases: string[];
  default_unit: string | null;
  image_url: string | null;
  image_ready: boolean;
  source: string;
  source_notes: string | null;
  preferred_store_hint: string | null;
};

function buildCatalogRows(rows: CsvRow[]): CatalogRow[] {
  const byId = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const list = byId.get(row.id) ?? [];
    list.push(row);
    byId.set(row.id, list);
  }

  const result: CatalogRow[] = [];
  for (const [id, group] of byId) {
    const primary =
      group.find((r) => r.subcategory !== "Scraped Store Example") ?? group[0];
    const rest = group.filter((r) => r !== primary);

    const aliasSet = new Set<string>(
      primary.search_aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    );
    for (const extra of rest) {
      for (const a of extra.search_aliases.split(",").map((x) => x.trim())) {
        if (a) aliasSet.add(a);
      }
    }

    let subcategory = primary.subcategory || null;
    let sourceNotes = primary.notes || null;
    if (subcategory === "Scraped Store Example") {
      subcategory = SCRAPED_SUBCATEGORY_FIX[id] ?? null;
    }
    for (const extra of rest) {
      if (extra.preferred_store && extra.preferred_store !== primary.preferred_store) {
        const extraNote = `Also available at ${extra.preferred_store}.`;
        sourceNotes = sourceNotes ? `${sourceNotes} ${extraNote}` : extraNote;
      }
    }

    const rawStore = primary.preferred_store || null;
    result.push({
      id,
      normalized_name: normalize(primary.name),
      display_name: primary.name,
      brand: primary.brand || null,
      category: primary.category,
      subcategory,
      search_aliases: [...aliasSet],
      default_unit: primary.default_unit || null,
      image_url:
        primary.image_ready === "yes" && primary.image_path
          ? `/images/products/${primary.image_path.split("/").pop()}`
          : null,
      image_ready: primary.image_ready === "yes",
      source: "homeassist_product_library_v1",
      source_notes: sourceNotes,
      preferred_store_hint: rawStore ? RETAILER_NAME_ALIASES[rawStore] ?? rawStore : null,
    });
  }
  return result;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: import-product-library.ts <path-to-products.csv>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  const csvText = readFileSync(csvPath, "utf8");
  const rows = buildCatalogRows(parseCsv(csvText));
  console.log(`Parsed ${rows.length} unique catalog products from ${csvPath}.`);

  const supabase = createClient(url, serviceKey);

  // Resolve preferred_store_hint -> retailers.id where a matching retailer exists.
  const { data: retailers } = await supabase.from("retailers").select("id, name");
  const retailerIdByName = new Map((retailers ?? []).map((r) => [r.name, r.id]));

  const payload = rows.map((r) => ({
    ...r,
    preferred_retailer_id: r.preferred_store_hint
      ? (retailerIdByName.get(r.preferred_store_hint) ?? null)
      : null,
  }));

  const chunkSize = 100;
  let upserted = 0;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    // manually_edited rows are protected by 0004's design: this client-side
    // upsert always sends the full row, so instead we skip any id already
    // marked manually_edited by checking first — the DB is the source of
    // truth for that flag, not this script's input.
    const ids = chunk.map((c) => c.id);
    const { data: existing } = await supabase
      .from("catalog_products")
      .select("id")
      .in("id", ids)
      .eq("manually_edited", true);
    const protectedIds = new Set((existing ?? []).map((r) => r.id));
    const toUpsert = chunk.filter((c) => !protectedIds.has(c.id));

    if (toUpsert.length === 0) continue;
    const { error } = await supabase.from("catalog_products").upsert(toUpsert, { onConflict: "id" });
    if (error) throw error;
    upserted += toUpsert.length;
  }

  console.log(`Upserted ${upserted} catalog products (${payload.length - upserted} skipped as manually edited).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
