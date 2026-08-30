import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

// Magic-link landing spot: @supabase/ssr's signInWithOtp sends the user
// back here with a one-time `code`, which we exchange for a real session
// cookie before sending them into the app (or onboarding, per middleware).
//
// Redirect targets are built from the canonical site URL, not the incoming
// request's origin — Vercel can front a request under more than one host
// (preview URLs, internal proxy hosts), and this route must never send an
// authenticated user somewhere other than the real app.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const siteUrl = getSiteUrl();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${siteUrl}/home`);
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth`);
}
