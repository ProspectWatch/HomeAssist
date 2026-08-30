import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client, reading the same cookies the server writes.
 *
 * `detectSessionInUrl` is off deliberately. HomeAssist exchanges the magic-link
 * code server-side in /auth/callback, and the PKCE code verifier lives in an
 * httpOnly-scoped server cookie. A browser client that also tried to claim the
 * one-time code would either lose the race or spend the code without a
 * verifier it can read, producing a `bad_code_verifier` failure and no session.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { detectSessionInUrl: false } },
  );
}
