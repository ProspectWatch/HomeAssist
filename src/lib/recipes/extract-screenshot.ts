import "server-only";

import OpenAI from "openai";
import type { ImportedRecipe } from "./import-url";

/**
 * Reading a recipe out of a screenshot.
 *
 * The fallback for the pages the URL importer can't read — a photo of a
 * cookbook, a screenshot of an app, a recipe on a site with no structured
 * data. Same provider and same key as receipt reading, so nothing new has to
 * be configured.
 *
 * The rule the prompt leans on hardest is the same one receipts use: leave it
 * out rather than guess. An invented ingredient is worse than a missing one,
 * because the review screen can show a gap but cannot detect a confident
 * fabrication — and here the person reads the list once, in a shop, without
 * the original in front of them.
 */

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_MODEL = "gpt-5.6";

export function recipeModel(): string {
  return process.env.OPENAI_RECIPE_MODEL || process.env.OPENAI_RECEIPT_MODEL || DEFAULT_MODEL;
}

export function isScreenshotImportConfigured(): boolean {
  return !!process.env.CHATGPT_API_KEY;
}

const RECIPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "timeMinutes", "servings", "ingredients"],
  properties: {
    name: { type: ["string", "null"], description: "The recipe's title as written." },
    timeMinutes: {
      type: ["integer", "null"],
      description: "Total time in minutes, if stated. Null if not stated — do not estimate.",
    },
    servings: { type: ["string", "null"], description: "Yield as written, e.g. 'Serves 4'." },
    ingredients: {
      type: "array",
      description: "One entry per ingredient line, transcribed as written.",
      items: { type: "string" },
    },
  },
} as const;

const INSTRUCTIONS = `You transcribe recipes from images. You are reading, not writing.

1. Transcribe only what is legibly visible. Never complete a recipe from
   knowledge of how that dish is usually made — a plausible ingredient that
   is not in the image is the worst possible output, because nobody
   reviewing the result can tell it apart from one that is.
2. One ingredient per entry, exactly as written, including quantities.
   "2 cups flour" stays as one line.
3. If part of the list is cut off or unreadable, return the part you can read.
   Do not fill the gap.
4. timeMinutes only if a total or cook time is printed. Do not estimate from
   the method.
5. If the image is not a recipe at all, return null for name and an empty
   ingredient list.`;

export type ScreenshotImportResult =
  | { ok: true; recipe: ImportedRecipe }
  | { ok: false; message: string };

export async function extractRecipeFromImage(document: {
  bytes: Uint8Array;
  mediaType: string;
}): Promise<ScreenshotImportResult> {
  const apiKey = process.env.CHATGPT_API_KEY;
  if (!apiKey) {
    return { ok: false, message: "Reading screenshots isn't configured on this deployment." };
  }
  if (!SUPPORTED_IMAGE_TYPES.has(document.mediaType)) {
    return { ok: false, message: "Use a JPEG, PNG or WebP screenshot." };
  }

  const client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 1 });
  const dataUrl = `data:${document.mediaType};base64,${Buffer.from(document.bytes).toString("base64")}`;

  try {
    const response = await client.responses.create({
      model: recipeModel(),
      instructions: INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            { type: "input_image", image_url: dataUrl, detail: "high" },
            {
              type: "input_text",
              text: "Transcribe this recipe. Leave out anything you cannot read.",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "recipe_extraction",
          schema: RECIPE_SCHEMA as unknown as Record<string, unknown>,
          strict: true,
        },
      },
    });

    const text = response.output_text;
    if (!text) return { ok: false, message: "Couldn't read anything from that image." };

    const parsed = JSON.parse(text) as {
      name: string | null;
      timeMinutes: number | null;
      servings: string | null;
      ingredients: string[];
    };

    const name = parsed.name?.trim();
    const ingredients = (parsed.ingredients ?? [])
      .map((i) => i.replace(/\s+/g, " ").trim())
      .filter((i) => i.length > 0);

    if (!name) return { ok: false, message: "That doesn't look like a recipe." };
    if (ingredients.length === 0) {
      // A name with no ingredients reads as a successful import and isn't one.
      return { ok: false, message: `Read the title "${name}" but couldn't make out the ingredients.` };
    }

    return {
      ok: true,
      recipe: {
        name,
        timeMinutes: parsed.timeMinutes ?? null,
        servings: parsed.servings?.trim() || null,
        ingredients,
        sourceUrl: "",
      },
    };
  } catch {
    // Deliberately no detail: provider errors can carry request context, and
    // this string is shown to a person and written to logs.
    return { ok: false, message: "Couldn't read that screenshot. Try a clearer crop." };
  }
}
