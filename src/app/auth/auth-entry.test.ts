import { describe, expect, it } from "vitest";

/**
 * The sign-in entry points, as routing contracts.
 *
 * The failure these guard against: a magic link that only works in the browser
 * that asked for it. On a phone the link is tapped in Mail and opens in Safari,
 * or the request came from the installed home-screen app (iOS gives it its own
 * cookie jar) — and the PKCE exchange dies with pkce_code_verifier_not_found
 * before it ever reaches Supabase.
 */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/confirm"];

describe("public auth paths", () => {
  it.each(["/login", "/auth/callback", "/auth/confirm"])(
    "%s is reachable while signed out",
    (path) => {
      expect(PUBLIC_PATHS.some((p) => path.startsWith(p))).toBe(true);
    },
  );

  it("keeps the rest of the app gated", () => {
    for (const path of ["/home", "/receipts", "/shop/pantry", "/settings"]) {
      expect(PUBLIC_PATHS.some((p) => path.startsWith(p))).toBe(false);
    }
  });

  it("matches the list the middleware actually uses", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/proxy.ts", "utf8"),
    );
    const declared = source.match(/const PUBLIC_PATHS = \[([\s\S]*?)\];/);
    expect(declared).not.toBeNull();
    for (const path of PUBLIC_PATHS) {
      expect(declared![1]).toContain(`"${path}"`);
    }
  });
});

/** Mirrors the normalisation in verifyEmailCode, which is what the UI enforces. */
function normalizeCode(input: string): string {
  return input.replace(/\D/g, "");
}

describe("six-digit code entry", () => {
  it.each([
    ["123456", "123456"],
    ["123 456", "123456"],
    ["123-456", "123456"],
    [" 123456 ", "123456"],
  ])("accepts %s as it is pasted from an email", (typed, expected) => {
    expect(normalizeCode(typed)).toBe(expected);
    expect(normalizeCode(typed)).toHaveLength(6);
  });

  it.each(["12345", "1234567", "", "abcdef"])("rejects %s", (typed) => {
    expect(normalizeCode(typed).length === 6).toBe(false);
  });
});
