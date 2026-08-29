import { createClient } from "@/lib/supabase/server";

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
};

const DOT_COLOR: Record<string, string> = {
  target_price_hit: "#3F7A55",
  price_drop: "#6E8291",
  restock: "#4C8A63",
  regular_buy_deal: "#B8946A",
};

export function notificationDotColor(kind: string) {
  return DOT_COLOR[kind] ?? "#9C9166";
}

const KIND_LABEL: Record<string, string> = {
  target_price_hit: "Target Price Hit",
  price_drop: "Price Drop",
  restock: "Back in Stock",
  regular_buy_deal: "Regular Buy",
};

export function notificationKindLabel(kind: string) {
  return KIND_LABEL[kind] ?? kind;
}

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
