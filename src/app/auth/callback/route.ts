import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSiteUrl } from "@/lib/site-url";
import type { Database } from "@/types/database";

// Magic-link landing spot: @supabase/ssr's signInWithOtp sends the user
// back here with a one-time `code`, which we exchange for a real session
// cookie before sending them into the app (or onboarding, per middleware).
//
// Redirect targets are built from the canonical site URL, not the incoming
// request's origin — Vercel can front a request under more than one host
// (preview URLs, internal proxy hosts), and this route must never send an
// authenticated user somewhere other than the real app.
//
// The session cookies are collected and written straight onto the redirect we
// return, rather than through next/headers' cookie store. This is the one
// response that turns a magic link into a lasting session; if its Set-Cookie
// headers don't reach the browser there is no session at all, so nothing here
// relies on the framework merging a mutation made somewhere else.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const siteUrl = getSiteUrl();

  if (!code) return NextResponse.redirect(`${siteUrl}/login?error=auth`);

  const cookieStore = await cookies();
  const written: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          written.push(...cookiesToSet);
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // On failure the writes are cookie deletions — carry them too, so a spent
  // code doesn't leave a half-written session behind to fail again later.
  const response = NextResponse.redirect(error ? `${siteUrl}/login?error=auth` : `${siteUrl}/home`);
  for (const { name, value, options } of written) {
    response.cookies.set(name, value, options);
  }
  return response;
}
