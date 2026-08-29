import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the signed-in user's household, server-side. Returns null when
 * there is no session or the user isn't linked to a household yet — every
 * caller must treat that as a real, expected state (not an error): render
 * the honest "not connected" / empty state rather than fabricating data.
 *
 * There is no auth/onboarding UI yet (Phase 1 scope), so today this always
 * returns null in a browser session — that's expected until sign-in and a
 * live Supabase project exist, not a bug in the screens that call this.
 */
export async function getCurrentHouseholdId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    return data?.household_id ?? null;
  } catch {
    // No live Supabase project configured yet, or a network error — treat
    // the same as "not connected" rather than throwing in a server component.
    return null;
  }
}
