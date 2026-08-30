/**
 * Uploads normalized product images to the `product-images` Supabase
 * Storage bucket and updates catalog_products.image_url/image_ready to
 * point at them. Requires the service-role key — never run this from
 * client/browser code, and never commit that key anywhere.
 *
 * This script does not fabricate or fetch images itself: it expects a
 * local directory already containing real, sourced, normalized
 * (1200x1200, white/neutral background, no cropping/stretching, no
 * price labels or watermarks) image files named after each
 * catalog_products.id — e.g. `cottage-cheese.jpg` — matching
 * docs/image-acquisition-manifest.csv's `local_storage_filename` column
 * (minus the leading `/images/products/`). Products that share a
 * manifest filename (a legitimate dedupe, e.g. neilson-2-milk.jpg for
 * both Neilson milk sizes) only need that one file present.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *     npx tsx scripts/upload-product-images.ts path/to/sourced-images-dir
 *
 * Safe to run repeatedly: re-uploads (upsert) only files present in the
 * directory, and never touches a catalog_products row already flagged
 * manually_edited.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { parse } from "node:path/posix";

const BUCKET = "product-images";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type ManifestRow = {
  catalog_product_id: string;
  local_storage_filename: string;
};

function parseCsv(text: string): ManifestRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsvLine(lines[0]);
  const idIdx = header.indexOf("catalog_product_id");
  const fileIdx = header.indexOf("local_storage_filename");
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return { catalog_product_id: cells[idIdx], local_storage_filename: cells[fileIdx] };
  });
}

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

async function main() {
  const imagesDir = process.argv[2];
  if (!imagesDir) {
    console.error("Usage: upload-product-images.ts <path-to-sourced-images-dir>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  const manifestPath = join(__dirname, "..", "docs", "image-acquisition-manifest.csv");
  const manifest = parseCsv(readFileSync(manifestPath, "utf8"));

  const availableFiles = new Set(readdirSync(imagesDir));
  const supabase = createClient(url, serviceKey);

  const { data: manuallyEdited } = await supabase
    .from("catalog_products")
    .select("id")
    .eq("manually_edited", true);
  const protectedIds = new Set((manuallyEdited ?? []).map((r) => r.id));

  // Group manifest rows by target filename so a shared dedupe file only uploads once.
  const byFilename = new Map<string, string[]>();
  for (const row of manifest) {
    const filename = parse(row.local_storage_filename).base;
    const list = byFilename.get(filename) ?? [];
    list.push(row.catalog_product_id);
    byFilename.set(filename, list);
  }

  let uploaded = 0;
  let updated = 0;
  let skippedMissingFile = 0;
  let skippedManuallyEdited = 0;

  for (const [filename, productIds] of byFilename) {
    if (!availableFiles.has(filename)) {
      skippedMissingFile += productIds.length;
      continue;
    }

    const ext = extname(filename).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
    const bytes = readFileSync(join(imagesDir, filename));

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, bytes, { contentType, upsert: true });
    if (uploadError) {
      console.error(`Upload failed for ${filename}: ${uploadError.message}`);
      continue;
    }
    uploaded++;

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);

    for (const productId of productIds) {
      if (protectedIds.has(productId)) {
        skippedManuallyEdited++;
        continue;
      }
      const { error: updateError } = await supabase
        .from("catalog_products")
        .update({ image_url: publicUrlData.publicUrl, image_ready: true })
        .eq("id", productId);
      if (updateError) {
        console.error(`Failed to update ${productId}: ${updateError.message}`);
        continue;
      }
      updated++;
    }
  }

  console.log(
    `Uploaded ${uploaded} image file(s), updated ${updated} catalog_products row(s). ` +
      `Skipped ${skippedMissingFile} row(s) with no sourced file yet, ${skippedManuallyEdited} manually-edited row(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
