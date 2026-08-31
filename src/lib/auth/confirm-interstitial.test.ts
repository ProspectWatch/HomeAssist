import { describe, expect, it } from "vitest";
import { interstitialResponse, renderConfirmInterstitial } from "./confirm-interstitial";

describe("renderConfirmInterstitial", () => {
  const html = renderConfirmInterstitial({
    action: "/auth/confirm",
    fields: { token_hash: "abc123", type: "email" },
  });

  it("posts rather than linking, so a scanner's GET cannot spend the token", () => {
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/auth/confirm"');
    // No navigable link that a crawler would follow.
    expect(html).not.toMatch(/<a\s/i);
  });

  it("carries the token through as a hidden field", () => {
    expect(html).toContain('name="token_hash"');
    expect(html).toContain('value="abc123"');
    expect(html).toContain('value="email"');
  });

  it("keeps the token out of referrers and out of search engines", () => {
    expect(html).toContain('name="referrer" content="no-referrer"');
    expect(html).toContain('name="robots" content="noindex, nofollow"');
  });

  it("needs no JavaScript to work", () => {
    expect(html).not.toMatch(/<script/i);
  });

  it("escapes field values instead of writing them into the markup raw", () => {
    const hostile = renderConfirmInterstitial({
      action: "/auth/confirm",
      fields: { token_hash: '"><script>alert(1)</script>' },
    });
    expect(hostile).not.toContain("<script>alert(1)</script>");
    expect(hostile).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("shows an error when one is passed, and nothing when it isn't", () => {
    expect(renderConfirmInterstitial({ action: "/a", fields: {}, error: "Nope" })).toContain("Nope");
    expect(renderConfirmInterstitial({ action: "/a", fields: {} })).not.toContain('class="error"');
  });
});

describe("interstitialResponse", () => {
  it("is never cached or stored — the URL it was reached by carries a secret", () => {
    const res = interstitialResponse("<html></html>");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });
});
