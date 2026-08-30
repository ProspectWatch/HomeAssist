import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; message: string };

export const NOT_CONNECTED: ActionResult = {
  ok: false,
  message: "You're not signed in to a household — sign in and join or create one first.",
};

/**
 * Resolves the current household and Supabase client, then runs `fn`.
 * Every write in the app goes through this so "no session yet" and
 * "the request failed" both surface as an honest ActionResult instead of
 * a fabricated success or an unhandled exception.
 */
export async function runHouseholdAction(
  fn: (supabase: SupabaseClient<Database>, householdId: string) => Promise<ActionResult>,
): Promise<ActionResult> {
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NOT_CONNECTED;
  try {
    const supabase = await createClient();
    return await fn(supabase, householdId);
  } catch {
    return { ok: false, message: "Couldn't reach the server. Try again." };
  }
}
