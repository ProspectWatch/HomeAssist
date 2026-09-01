import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getNotifications } from "@/lib/data/notifications";
import { NotificationsView } from "./notifications-view";

export default async function NotificationsPage() {
  const householdId = await getCurrentHouseholdId();
  const notifications = await getNotifications(householdId);
  return <NotificationsView notifications={notifications} />;
}
