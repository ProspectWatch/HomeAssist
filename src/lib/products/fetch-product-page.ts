import "server-only";

import { checkRecipeUrl } from "@/lib/recipes/import-url";
import { refusalMessage } from "@/lib/recipes/refusal";
import { parseProductFromHtml, type ProductImportResult } from "./link-import";

/**
 * Fetching a shop's product page from the server.
 *
 * Reuses the URL guard written for recipe imports rather than writing a second
 * one: the danger is identical — a pasted address, fetched server-side, is an
 * invitation to reach something on the private network — and one guard that is
 * tested is worth more than two that are nearly the same. Redirects are
 * followed by hand so every hop is re-checked.
 *
 * It presents itself as an ordinary browser here, unlike the recipe importer.
 * Shops routinely refuse an unrecognised agent outright, and the request is a
 * person asking for one page they are looking at — not a crawl. Nothing is
 * done beyond that to disguise it: a shop behind a bot wall is reported as
 * refusing, not worked around.
 */

const MAX_REDIRECTS = 5;
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-CA,en;q=0.9",
};

export async function importProductFromUrl(rawUrl: string): Promise<ProductImportResult> {
  const checked = checkRecipeUrl(rawUrl);
  if (!checked.ok) return checked;

  let current = checked.url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await fetch(current, {
        headers: HEADERS,
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { ok: false, message: "That link redirected to nowhere." };
        const recheck = checkRecipeUrl(new URL(location, current).toString());
        if (!recheck.ok) return { ok: false, message: "That link redirects somewhere it shouldn't." };
        current = recheck.url;
        continue;
      }

      if (!response.ok) return { ok: false, message: refusalMessage(response) };

      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("html")) return { ok: false, message: "That link isn't a web page." };

      const reader = response.body?.getReader();
      if (!reader) return { ok: false, message: "That page came back empty." };

      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.length;
        if (total > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      const buffer = new Uint8Array(total > MAX_BYTES ? MAX_BYTES : total);
      let offset = 0;
      for (const chunk of chunks) {
        if (offset + chunk.length > buffer.length) {
          buffer.set(chunk.subarray(0, buffer.length - offset), offset);
          break;
        }
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      return parseProductFromHtml(new TextDecoder("utf-8").decode(buffer), current.toString());
    }
    return { ok: false, message: "That link redirects too many times." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.name === "AbortError"
          ? "That shop took too long to answer."
          : "Couldn't reach that shop.",
    };
  } finally {
    clearTimeout(timer);
  }
}
