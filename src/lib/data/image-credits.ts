import { createClient } from "@/lib/supabase/server";

/**
 * Credits for the catalogue's product photography.
 *
 * Most of these images are CC BY-SA, which permits this use on condition the
 * author is named. Attribution is stored per product when the image is
 * recorded, and listed here — one page naming every author and licence, with
 * a link to the source — which is how attribution is normally satisfied for a
 * collection of images used at thumbnail size.
 */
export type ImageCredit = {
  name: string;
  attribution: string;
  license: string;
  sourceUrl: string | null;
};

const PAGE_SIZE = 1000;

export async function getImageCredits(): Promise<ImageCredit[]> {
  try {
    const supabase = await createClient();
    const all: ImageCredit[] = [];
    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("display_name, image_attribution, image_license, image_source_url")
        .not("image_attribution", "is", null)
        .order("display_name")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) return all;
      type Row = {
        display_name: string;
        image_attribution: string;
        image_license: string | null;
        image_source_url: string | null;
      };
      const rows = (data ?? []) as Row[];
      for (const row of rows) {
        all.push({
          name: row.display_name,
          attribution: row.image_attribution,
          license: row.image_license ?? "See source",
          sourceUrl: row.image_source_url,
        });
      }
      if (rows.length < PAGE_SIZE) return all;
    }
  } catch {
    return [];
  }
}
