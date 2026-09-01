import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/notifications/model";

export type { Notification } from "@/lib/notifications/model";
export { notificationDotColor, notificationKindLabel } from "@/lib/notifications/model";

export async function getNotifications(householdId: string | null): Promise<Notification[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("id, kind, title, body, read")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function hasUnreadNotifications(householdId: string | null): Promise<boolean> {
  const items = await getNotifications(householdId);
  return items.some((n) => !n.read);
}
