import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSiteUrl } from "@/lib/site-url";
import { interstitialResponse, renderConfirmInterstitial } from "@/lib/auth/confirm-interstitial";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Magic-link landing spot that does NOT depend on the browser.
 *
 * /auth/callback uses the PKCE `code` flow, which can only be completed by the
 * same browser that asked for the link: the code verifier is a cookie written
 * when the link is requested. On a phone that assumption breaks constantly —
 * the link is tapped in Mail and opens in Safari, or the request came from the
 * installed home-screen app, which iOS gives its own cookie jar.
 *
 * verifyOtp() with a token hash carries the proof in the URL instead, so any
 * browser can complete the sign-in. Requires the Supabase email template to
 * link here with {{ .TokenHash }}.
 *
 * As with /auth/callback, a GET only renders the confirmation page — the
 * sign-in happens on POST, so an email scanner's fetch cannot spend the token.
 */

const VALID_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

function parseType(raw: string | null): EmailOtpType {
  return VALID_TYPES.includes(raw as EmailOtpType) ? (raw as EmailOtpType) : "email";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  if (!tokenHash) return NextResponse.redirect(`${getSiteUrl()}/login?error=auth`);

  return interstitialResponse(
    renderConfirmInterstitial({
      action: "/auth/confirm",
      fields: { token_hash: tokenHash, type: parseType(searchParams.get("type")) },
    }),
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = parseType(String(form.get("type") ?? ""));
  const siteUrl = getSiteUrl();

  if (!tokenHash) return NextResponse.redirect(`${siteUrl}/login?error=auth`, { status: 303 });

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

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  // Session cookies go straight onto the redirect — this is the one response
  // that turns a link into a lasting session.
  const response = NextResponse.redirect(
    error ? `${siteUrl}/login?error=link` : `${siteUrl}/home`,
    { status: 303 },
  );
  for (const { name, value, options } of written) {
    response.cookies.set(name, value, options);
  }
  return response;
}
