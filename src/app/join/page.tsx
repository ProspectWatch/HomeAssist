import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { JoinView } from "./join-view";

/**
 * Landing spot for a shared invite link.
 *
 * Reading a join code off one phone and typing it into another works, but it
 * is the part people get wrong. A link the inviter can text does the typing
 * for them; the code itself is unchanged, so this is a nicer front door to the
 * existing mechanism rather than a second one.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed out: sign in first, keeping the code so it isn't lost on the way.
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join?code=${code ?? ""}`)}`);
  }

  // Already in a household — nothing to join, and silently switching someone
  // between households would be worse than saying so.
  const householdId = await getCurrentHouseholdId();
  if (householdId) return <JoinView state="already-member" />;

  if (!code) return <JoinView state="no-code" />;
  return <JoinView state="ready" code={code} />;
}
