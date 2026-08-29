import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link landing spot: @supabase/ssr's signInWithOtp sends the user
// back here with a one-time `code`, which we exchange for a real session
// cookie before sending them into the app (or onboarding, per middleware).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/home`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
