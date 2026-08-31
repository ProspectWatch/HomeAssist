import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

/* ------------------------------------------------------------------ *
 * These tests model the thing that actually breaks a magic-link app:
 * the session lives ONLY in cookies, and a refresh token is single-use.
 * The fake below therefore models a real browser cookie jar (it keeps
 * only cookies it is actually sent) and a real rotating auth server (it
 * revokes a refresh token the moment it issues the replacement).
 *
 * No network call is made and no real credentials are used.
 * ------------------------------------------------------------------ */

const COOKIE = "sb-test-auth-token";

/** Seconds; mirrors Supabase's default access-token lifetime. */
const ACCESS_TOKEN_TTL = 3600;
/** Seconds; mirrors GoTrue's refresh-token reuse interval. */
const REUSE_INTERVAL = 10;

type StoredSession = { access: string; refresh: string; expiresAt: number };

let now = 1_000_000;
const clock = () => now;

/** The auth server's view of refresh tokens: single-use, with a reuse window. */
class FakeAuthServer {
  private issued = 0;
  /** refresh token -> the child it was already swapped for, and when. */
  private rotated = new Map<string, { child: StoredSession; at: number }>();
  private live = new Set<string>();
  userId = "user-1";
  hasMembership = true;

  /** Establishes a session, as /auth/callback does after a magic link. */
  signIn(): StoredSession {
    const refresh = `rt-${++this.issued}`;
    this.live.add(refresh);
    return { access: `at-${this.issued}`, refresh, expiresAt: clock() + ACCESS_TOKEN_TTL };
  }

  signOutAll() {
    this.live.clear();
    this.rotated.clear();
  }

  /** Returns the replacement session, or null when the token is spent. */
  refresh(token: string): StoredSession | null {
    const previous = this.rotated.get(token);
    if (previous) {
      // Within the reuse interval a repeat presentation gets the same child;
      // after it, the token is simply revoked.
      return clock() - previous.at <= REUSE_INTERVAL ? previous.child : null;
    }
    if (!this.live.has(token)) return null;

    this.live.delete(token);
    const child = this.signIn();
    this.rotated.set(token, { child, at: clock() });
    return child;
  }
}

let server: FakeAuthServer;
/** Every /token call the middleware made, for the concurrency assertions. */
let refreshCalls: string[];

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, opts: {
    cookies: {
      getAll(): { name: string; value: string }[];
      setAll(c: { name: string; value: string; options?: Record<string, unknown> }[]): void;
    };
  }) => {
    const read = (): StoredSession | null => {
      const raw = opts.cookies.getAll().find((c) => c.name === COOKIE)?.value;
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StoredSession;
      } catch {
        return null;
      }
    };
    const write = (session: StoredSession) =>
      opts.cookies.setAll([
        { name: COOKIE, value: JSON.stringify(session), options: { path: "/", maxAge: 34_560_000 } },
      ]);
    const clear = () =>
      opts.cookies.setAll([{ name: COOKIE, value: "", options: { path: "/", maxAge: 0 } }]);

    return {
      auth: {
        async getUser() {
          const stored = read();
          if (!stored) return { data: { user: null }, error: null };

          if (stored.expiresAt > clock()) {
            return { data: { user: { id: server.userId } }, error: null };
          }

          refreshCalls.push(stored.refresh);
          const next = server.refresh(stored.refresh);
          if (!next) {
            // Supabase clears a session it can no longer use.
            clear();
            return { data: { user: null }, error: { message: "refresh_token_not_found" } };
          }
          write(next);
          return { data: { user: { id: server.userId } }, error: null };
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: server.hasMembership ? { id: "membership-1" } : null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
  },
}));

const { proxy } = await import("./proxy");

/** A browser: keeps only the cookies it is actually sent. */
class Browser {
  jar = new Map<string, string>();

  request(path: string): NextRequest {
    const req = new NextRequest(`https://homeassist-flame.vercel.app${path}`);
    for (const [name, value] of this.jar) req.cookies.set(name, value);
    return req;
  }

  /** Applies Set-Cookie exactly as a browser would — including deletions. */
  apply(response: NextResponse) {
    for (const cookie of response.cookies.getAll()) {
      if (cookie.maxAge === 0) this.jar.delete(cookie.name);
      else this.jar.set(cookie.name, cookie.value);
    }
  }

  async visit(path: string) {
    const response = await proxy(this.request(path));
    this.apply(response);
    return {
      status: response.status,
      location: response.headers.get("location"),
      signedIn: this.jar.has(COOKIE),
    };
  }
}

function signInTo(browser: Browser) {
  browser.jar.set(COOKIE, JSON.stringify(server.signIn()));
}

/** Moves past the access token's lifetime without touching the session. */
function accessTokenExpires() {
  now += ACCESS_TOKEN_TTL + 60;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-not-real";
  now = 1_000_000;
  server = new FakeAuthServer();
  refreshCalls = [];
});

describe("page reload", () => {
  it("keeps the session and does not redirect", async () => {
    const browser = new Browser();
    signInTo(browser);
    const before = browser.jar.get(COOKIE);

    const result = await browser.visit("/home");

    expect(result.location).toBeNull();
    expect(result.signedIn).toBe(true);
    expect(browser.jar.get(COOKIE)).toBe(before);
    expect(refreshCalls).toHaveLength(0);
  });

  it("survives repeated reloads across several token lifetimes", async () => {
    const browser = new Browser();
    signInTo(browser);

    for (let i = 0; i < 5; i++) {
      accessTokenExpires();
      const result = await browser.visit("/home");
      expect(result.location).toBeNull();
      expect(result.signedIn).toBe(true);
    }
    expect(refreshCalls).toHaveLength(5);
  });
});

describe("token refresh", () => {
  it("rotates the refresh token and gives the browser the replacement", async () => {
    const browser = new Browser();
    signInTo(browser);
    const original = JSON.parse(browser.jar.get(COOKIE)!) as StoredSession;
    accessTokenExpires();

    await browser.visit("/home");

    const rotated = JSON.parse(browser.jar.get(COOKIE)!) as StoredSession;
    expect(rotated.refresh).not.toBe(original.refresh);
    expect(rotated.expiresAt).toBeGreaterThan(clock());
  });

  // The regression this whole fix exists for: a request that BOTH refreshes
  // the session AND redirects must not drop the rotated cookie on the floor.
  it("carries the rotated session through the /login -> /home redirect", async () => {
    const browser = new Browser();
    signInTo(browser);
    const original = JSON.parse(browser.jar.get(COOKIE)!) as StoredSession;
    accessTokenExpires();

    const redirected = await browser.visit("/login");
    expect(redirected.location).toBe("https://homeassist-flame.vercel.app/home");

    const rotated = JSON.parse(browser.jar.get(COOKIE)!) as StoredSession;
    expect(rotated.refresh).not.toBe(original.refresh);

    // And the very next request still works — under the old code the browser
    // was left holding the revoked token and landed back on /login.
    accessTokenExpires();
    const next = await browser.visit("/home");
    expect(next.location).toBeNull();
    expect(next.signedIn).toBe(true);
  });

  it("carries the rotated session through the /onboarding redirect", async () => {
    server.hasMembership = false;
    const browser = new Browser();
    signInTo(browser);
    const original = JSON.parse(browser.jar.get(COOKIE)!) as StoredSession;
    accessTokenExpires();

    const redirected = await browser.visit("/home");
    expect(redirected.location).toBe("https://homeassist-flame.vercel.app/onboarding");
    expect(JSON.parse(browser.jar.get(COOKIE)!).refresh).not.toBe(original.refresh);

    server.hasMembership = true;
    accessTokenExpires();
    expect((await browser.visit("/home")).signedIn).toBe(true);
  });
});

describe("browser reopen", () => {
  it("signs the user straight back in from cookies alone, hours later", async () => {
    const browser = new Browser();
    signInTo(browser);

    // Closed the tab; nothing but the cookie jar survives.
    now += 6 * 3600;

    const result = await browser.visit("/home");
    expect(result.location).toBeNull();
    expect(result.signedIn).toBe(true);
  });

  it("needs no magic link across a week of daily reopens", async () => {
    const browser = new Browser();
    signInTo(browser);

    for (let day = 0; day < 7; day++) {
      now += 24 * 3600;
      const result = await browser.visit("/home");
      expect(result.location).toBeNull();
    }
  });
});

describe("PWA reopen", () => {
  it("holds up when one launch fires many concurrent requests", async () => {
    const browser = new Browser();
    signInTo(browser);
    accessTokenExpires();

    // A real launch of the installed app measured ~20 middleware invocations
    // in ~3 seconds (the page, its RSC payload, and a prefetch per nav link).
    // They all present the same single-use refresh token.
    const requests = Array.from({ length: 20 }, () => browser.request("/home"));
    const responses = await Promise.all(requests.map((r) => proxy(r)));

    for (const response of responses) {
      expect(response.headers.get("location")).toBeNull();
    }
    for (const response of responses) browser.apply(response);
    expect(browser.jar.has(COOKIE)).toBe(true);

    // And the app is still usable on the next launch.
    accessTokenExpires();
    expect((await browser.visit("/home")).location).toBeNull();
  });

  it("resumes at the manifest start_url without bouncing to /login", async () => {
    const browser = new Browser();
    signInTo(browser);
    accessTokenExpires();

    const result = await browser.visit("/home");
    expect(result.location).toBeNull();
    expect(result.signedIn).toBe(true);
  });
});

describe("explicit sign out", () => {
  it("ends the session and requires a new magic link", async () => {
    const browser = new Browser();
    signInTo(browser);

    // What signOut() does: revoke server-side, drop the cookie.
    server.signOutAll();
    browser.jar.delete(COOKIE);

    const result = await browser.visit("/home");
    expect(result.location).toBe("https://homeassist-flame.vercel.app/login");
    expect(result.signedIn).toBe(false);
  });

  it("leaves /login reachable so a new link can be requested", async () => {
    const browser = new Browser();
    const result = await browser.visit("/login");
    expect(result.location).toBeNull();
  });
});

describe("expired or revoked session", () => {
  it("sends the user to /login and clears the dead cookie", async () => {
    const browser = new Browser();
    signInTo(browser);
    server.signOutAll(); // e.g. revoked from another device

    accessTokenExpires();
    const result = await browser.visit("/home");

    expect(result.location).toBe("https://homeassist-flame.vercel.app/login");
    // Cleared, not left behind: a stale cookie that is re-read and re-rejected
    // on every request is how a sign-in loop starts.
    expect(browser.jar.has(COOKIE)).toBe(false);
  });

  it("treats an unreadable cookie as signed out rather than erroring", async () => {
    const browser = new Browser();
    browser.jar.set(COOKIE, "not-json-at-all");

    const result = await browser.visit("/home");
    expect(result.location).toBe("https://homeassist-flame.vercel.app/login");
  });
});

describe("route gating", () => {
  it("keeps a signed-out user out of the app", async () => {
    const browser = new Browser();
    const result = await browser.visit("/pantry");
    expect(result.location).toBe("https://homeassist-flame.vercel.app/login");
  });

  it("lets a signed-out user reach the auth callback", async () => {
    const browser = new Browser();
    const result = await browser.visit("/auth/callback");
    expect(result.location).toBeNull();
  });

  it("sends a signed-in user away from /login", async () => {
    const browser = new Browser();
    signInTo(browser);
    const result = await browser.visit("/login");
    expect(result.location).toBe("https://homeassist-flame.vercel.app/home");
  });

  it("lets the scheduler reach the cron endpoint with no session", async () => {
    // The scheduled scan runs when nobody is signed in and authenticates
    // itself with a bearer token. Bouncing it to /login made it fail
    // silently: no error, no scan job, just prices that never updated.
    const browser = new Browser();
    const result = await browser.visit("/api/cron/scan");
    expect(result.location).toBeNull();
  });

  it("still keeps a signed-out user out of other API routes", async () => {
    const browser = new Browser();
    const result = await browser.visit("/api/catalog");
    expect(result.location).toBe("https://homeassist-flame.vercel.app/login");
  });
});
