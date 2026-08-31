import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * A Supabase client that acts without a signed-in user.
 *
 * This exists for exactly one job: the scheduled price scan, which has to run
 * for a household when nobody is logged in, and so has no session for RLS to
 * check. Everything a person triggers keeps using the request-scoped,
 * cookie-authenticated client and stays inside RLS.
 *
 * `server-only` is the guard that matters. This module must never be reachable
 * from the browser bundle — importing it from a client component is a build
 * error, not a runtime surprise. The key lives only in the server environment
 * and is never sent anywhere: not to the browser, not into a URL, not into a
 * log line.
 *
 * If the key is absent the caller gets a clear failure rather than a client
 * that silently falls back to anonymous access and writes nothing.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — the scheduled scan cannot run without it.",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasAdminCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
