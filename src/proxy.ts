import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/confirm"];

// Reachable while signed in but not yet in a household — that is exactly who
// an invite link is for, so it must not be bounced to /onboarding.
const NO_HOUSEHOLD_PATHS = ["/onboarding", "/join"];

/**
 * Builds a redirect that carries every cookie the session refresh just wrote.
 *
 * This is not a nicety. `supabase.auth.getUser()` rotates the refresh token:
 * the moment a new one is issued the old one is revoked server-side. The
 * rotated tokens land on `carrying` via the `setAll` callback below. A bare
 * `NextResponse.redirect()` is a brand-new response with no cookies on it, so
 * returning one throws the rotated tokens away and leaves the browser holding
 * a refresh token the server has already revoked. The next request then can't
 * refresh, `getUser()` returns null, and the person is bounced to /login to
 * ask for another magic link — even though their session never expired.
 */
function redirectCarryingSession(to: URL, carrying: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(to);
  for (const cookie of carrying.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

// Refreshes the Supabase auth session on every request so Server Components
// always see a valid (non-expired) session without each page re-implementing
// this, then gates routes: signed-out users are sent to /login, and signed-in
// users with no household yet are sent to /onboarding.
//
// Cookies are the only place the session lives, so every path out of this
// function must return a response that carries whatever `setAll` wrote.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!user) {
    if (isPublicPath) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Carries the cookie deletions Supabase writes when it finds the stored
    // session unusable, so a genuinely dead session is cleared rather than
    // re-read and re-rejected on every subsequent request.
    return redirectCarryingSession(url, response);
  }

  if (pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return redirectCarryingSession(url, response);
  }

  if (NO_HOUSEHOLD_PATHS.some((path) => pathname.startsWith(path)) || isPublicPath) {
    return response;
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return redirectCarryingSession(url, response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
