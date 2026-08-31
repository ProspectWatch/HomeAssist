import { describe, expect, it } from "vitest";
import { refusalMessage } from "./refusal";

function res(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

describe("refusalMessage", () => {
  it("names a bot check rather than reporting a bare 403", () => {
    // moffitt.org answers exactly like this: Cloudflare, 403, cf-mitigated.
    // A bare "(403)" reads as a bug in the app and invites a pointless retry.
    const message = refusalMessage(res(403, { "cf-mitigated": "challenge", server: "cloudflare" }));
    expect(message).toContain("bot check");
    expect(message).toContain("screenshot");
  });

  it("recognises a Cloudflare 403 even without the mitigation header", () => {
    expect(refusalMessage(res(403, { server: "cloudflare" }))).toContain("bot check");
  });

  it("does not call an ordinary 403 a bot check", () => {
    expect(refusalMessage(res(403, { server: "nginx" }))).toContain("(403)");
  });

  it("says a paywall is a paywall", () => {
    expect(refusalMessage(res(402))).toContain("paywall");
    expect(refusalMessage(res(401))).toContain("login");
  });

  it("asks for patience on a rate limit", () => {
    expect(refusalMessage(res(429))).toContain("slow down");
  });

  it("keeps the plain answer for a missing page", () => {
    expect(refusalMessage(res(404))).toBe("That page doesn't exist any more.");
  });

  it("falls back to the status for anything unrecognised", () => {
    expect(refusalMessage(res(500))).toContain("(500)");
  });
});
