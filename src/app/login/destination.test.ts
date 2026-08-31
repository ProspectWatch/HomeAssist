import { describe, expect, it } from "vitest";
import { resolveSignInDestination, safeNext } from "./destination";

describe("where an invite lands someone", () => {
  // The regression: middleware preserves ?code= on the way to /login, but
  // nothing carried it any further, so the code was dropped and the person had
  // to type it anyway.
  it("sends an invited person to /join with their code intact", () => {
    expect(resolveSignInDestination({ code: "28a030ab" })).toBe("/join?code=28a030ab");
  });

  it("escapes a code that would break the query string", () => {
    expect(resolveSignInDestination({ code: "a b&c" })).toBe("/join?code=a%20b%26c");
  });

  it("prefers the invite code over any other destination", () => {
    expect(resolveSignInDestination({ code: "abc", next: "/shop/list" })).toBe("/join?code=abc");
  });

  it("falls back to home when there is nothing to honour", () => {
    expect(resolveSignInDestination({})).toBe("/home");
  });
});

describe("an in-app destination", () => {
  it.each(["/home", "/shop/list", "/receipts/123"])("keeps %s", (path) => {
    expect(safeNext(path)).toBe(path);
  });

  // Anything that could leave the site right after authenticating is refused.
  it.each([
    ["//evil.example.com", "protocol-relative"],
    ["https://evil.example.com", "absolute"],
    ["\\\\evil.example.com", "backslash"],
    ["/\\evil.example.com", "mixed slash"],
    ["javascript:alert(1)", "scheme"],
    ["", "empty"],
  ])("refuses %s (%s)", (path) => {
    expect(safeNext(path)).toBe("/home");
  });

  it("refuses an undefined destination", () => {
    expect(safeNext(undefined)).toBe("/home");
  });
});
