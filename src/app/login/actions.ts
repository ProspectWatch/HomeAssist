"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/helpers";

export async function sendMagicLink(email: string, origin: string): Promise<ActionResult> {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, message: "Enter your email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
