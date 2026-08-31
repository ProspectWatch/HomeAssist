import "server-only";

/**
 * Fetching Instacart pages, politely.
 *
 * This serves one household looking up the prices of its own groceries, and it
 * behaves like it: one request at a time, a pause between them, a hard ceiling
 * on how many go out in a run, and a wall-clock budget so a slow response ends
 * the run rather than the serverless function's 60-second limit killing it and
 * throwing away every price already found.
 *
 * It identifies itself as an ordinary browser and does nothing to disguise
 * what it is beyond that — no rotating agents, no proxies, no retry storms. If
 * the site starts refusing, the scan reports that it was refused rather than
 * working around it.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Pages are large; anything past this is not the part being read. */
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
/** Between requests. One household, one page at a time. */
export const REQUEST_PAUSE_MS = 900;

export type PageResult =
  | { ok: true; html: string }
  | { ok: false; status: number | null; reason: string };

export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchPage(url: string): Promise<PageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-CA,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reason:
          response.status === 403 || response.status === 429
            ? "Instacart declined the request"
            : `Instacart returned ${response.status}`,
      };
    }
    const reader = response.body?.getReader();
    if (!reader) return { ok: true, html: await response.text() };

    // Read with a cap: a runaway response should not become a memory problem.
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        size += value.length;
        if (size > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    return { ok: true, html: new TextDecoder().decode(concat(chunks, size)) };
  } catch (error) {
    return {
      ok: false,
      status: null,
      reason:
        error instanceof Error && error.name === "AbortError"
          ? "Instacart took too long to answer"
          : "Couldn't reach Instacart",
    };
  } finally {
    clearTimeout(timer);
  }
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    if (at + chunk.length > size) {
      out.set(chunk.subarray(0, size - at), at);
      break;
    }
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
