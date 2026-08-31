"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import type { ActionResult } from "@/lib/actions/helpers";
import { MAX_CODE_LENGTH, MIN_CODE_LENGTH } from "@/lib/auth/sign-in-code";

export async function sendMagicLink(email: string): Promise<ActionResult> {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, message: "Enter your email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/**
 * Signs in with the six-digit code from the same email.
 *
 * The code's length is whatever the Supabase project is configured to send
 * (it is a setting, not a constant), so nothing here assumes six digits.
 *
 * This is the path that cannot break. The magic link carries a PKCE code that
 * only the browser which requested it can redeem, so tapping it in Mail and
 * landing in a different browser — or in Safari when the request came from the
 * installed home-screen app, which iOS gives its own cookie jar — fails before
 * it reaches Supabase. A typed code is redeemed by whatever browser you are
 * already looking at, so where the email opens stops mattering.
 */
export async function verifyEmailCode(email: string, code: string): Promise<ActionResult> {
  const trimmed = email.trim();
  const token = code.replace(/\D/g, "");
  if (!trimmed) return { ok: false, message: "Enter your email first." };
  // Length is a Supabase project setting, not a constant — don't assume six.
  if (token.length < MIN_CODE_LENGTH || token.length > MAX_CODE_LENGTH) {
    return { ok: false, message: "Enter the code from the email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: trimmed, token, type: "email" });

  if (error) {
    return {
      ok: false,
      message:
        error.code === "otp_expired"
          ? "That code has expired — send a new one."
          : "That code didn't work. Check the digits and try again.",
    };
  }
  return { ok: true };
}
