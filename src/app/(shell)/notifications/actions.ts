"use server";

import { revalidatePath } from "next/cache";
import { runHouseholdAction, type ActionResult } from "@/lib/actions/helpers";

/**
 * Marking notifications read.
 *
 * Read/unread is not decoration here: it is what stops the same target-price
 * alert being raised again on the next scan. Without a way to clear one, an
 * alert would be announced once and then suppress itself forever.
 */
export async function markNotificationsRead(): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("household_id", householdId)
      .eq("read", false);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/notifications");
    revalidatePath("/home");
    return { ok: true };
  });
}

export async function dismissNotification(id: string): Promise<ActionResult> {
  return runHouseholdAction(async (supabase, householdId) => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("household_id", householdId);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/notifications");
    revalidatePath("/home");
    return { ok: true };
  });
}
