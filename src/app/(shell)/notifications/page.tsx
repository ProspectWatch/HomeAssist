import { TopBar } from "@/components/nav/top-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getNotifications, notificationDotColor, notificationKindLabel } from "@/lib/data/notifications";
import { Bell } from "lucide-react";

export default async function NotificationsPage() {
  const householdId = await getCurrentHouseholdId();
  const notifications = await getNotifications(householdId);

  return (
    <div className="pb-8">
      <TopBar title="Notifications" />
      {notifications.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Price-drop and restock alerts for your watch list will show up here."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {notifications.map((n) => (
            <div key={n.id} className="flex gap-2.5 rounded-(--radius-md) border border-line bg-white p-3.5 shadow-(--shadow-card)">
              <div
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: notificationDotColor(n.kind) }}
              />
              <div className="flex-1">
                <div className="text-[10px] font-bold tracking-[0.07em] text-oak uppercase">
                  {notificationKindLabel(n.kind)}
                </div>
                <div className="mt-0.5 text-sm font-semibold">{n.title}</div>
                <div className="mt-0.5 text-xs text-muted">{n.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
