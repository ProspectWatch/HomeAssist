import "server-only";

import { checkRecipeUrl } from "./import-url";

/**
 * Fetching a page the user pasted, from the server, safely.
 *
 * Three things make this different from a plain fetch:
 *
 * Redirects are followed by hand. Checking the pasted URL and then handing it
 * to fetch with automatic redirects checks nothing — a public address is free
 * to redirect to 169.254.169.254, and the guard would never see it. Every hop
 * is re-checked.
 *
 * The response is capped. A recipe page is a few hundred kilobytes; something
 * that streams forever would hold the function open until it times out.
 *
 * It gives up quickly. This runs inside a request somebody is waiting on, and
 * a slow site should fail with a sentence rather than spend the whole budget.
 */

const MAX_REDIRECTS = 5;
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

/** Identifies the app honestly, and asks for HTML rather than anything else. */
const HEADERS = {
  "User-Agent": "HomeAssist/1.0 (household recipe import; +https://homeassist-flame.vercel.app)",
  Accept: "text/html,application/xhtml+xml",
};

export type FetchedPage = { ok: true; html: string; finalUrl: string } | { ok: false; message: string };

export async function fetchRecipePage(rawUrl: string): Promise<FetchedPage> {
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
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { ok: false, message: "That link redirected to nowhere." };
        const next = new URL(location, current);
        // Re-check every hop: this is the whole point of following by hand.
        const recheck = checkRecipeUrl(next.toString());
        if (!recheck.ok) return { ok: false, message: "That link redirects somewhere it shouldn't." };
        current = recheck.url;
        continue;
      }

      if (!response.ok) {
        return {
          ok: false,
          message:
            response.status === 404
              ? "That page doesn't exist any more."
              : `That site wouldn't let us read the page (${response.status}). Try a screenshot instead.`,
        };
      }

      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("html")) {
        return { ok: false, message: "That link isn't a web page." };
      }

      const body = response.body;
      if (!body) return { ok: false, message: "That page came back empty." };

      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) {
          await reader.cancel();
          return { ok: false, message: "That page is too large to read." };
        }
        chunks.push(value);
      }

      const buffer = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      return {
        ok: true,
        html: new TextDecoder("utf-8").decode(buffer),
        finalUrl: current.toString(),
      };
    }

    return { ok: false, message: "That link redirects too many times." };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, message: "That site took too long to answer. Try a screenshot instead." };
    }
    return { ok: false, message: "Couldn't reach that site." };
  } finally {
    clearTimeout(timer);
  }
}
