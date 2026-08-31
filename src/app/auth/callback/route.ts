import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSiteUrl } from "@/lib/site-url";
import { interstitialResponse, renderConfirmInterstitial } from "@/lib/auth/confirm-interstitial";
import type { Database } from "@/types/database";

// Magic-link landing spot for the PKCE `code` flow, which is what
// {{ .ConfirmationURL }} in the default Supabase email template produces.
//
// A GET here deliberately does NOT sign anyone in. Email security scanners
// fetch every link in a message, and each fetch was redeeming the one-time
// code before the recipient could — see confirm-interstitial.ts for the
// evidence. GET renders a page with a button; POST does the exchange.
//
// Redirect targets are built from the canonical site URL, not the incoming
// request's origin — Vercel can front a request under more than one host
// (preview URLs, internal proxy hosts), and this route must never send an
// authenticated user somewhere other than the real app.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${getSiteUrl()}/login?error=auth`);

  return interstitialResponse(
    renderConfirmInterstitial({ action: "/auth/callback", fields: { code } }),
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") ?? "");
  const siteUrl = getSiteUrl();

  if (!code) return NextResponse.redirect(`${siteUrl}/login?error=auth`, { status: 303 });

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

  // The session cookies are written straight onto the redirect rather than
  // through next/headers' cookie store. This is the one response that turns a
  // link into a lasting session; if its Set-Cookie headers don't reach the
  // browser there is no session at all.
  //
  // On failure the writes are cookie deletions — carry them too, so a spent
  // code doesn't leave a half-written session behind to fail again later.
  // 303 so the browser follows with GET after this POST.
  const response = NextResponse.redirect(
    error ? `${siteUrl}/login?error=link` : `${siteUrl}/home`,
    { status: 303 },
  );
  for (const { name, value, options } of written) {
    response.cookies.set(name, value, options);
  }
  return response;
}
