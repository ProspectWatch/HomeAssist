"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shell/toast-context";
import { notificationDotColor, notificationKindLabel, type Notification } from "@/lib/notifications/model";
import { dismissNotification, markNotificationsRead } from "./actions";

export function NotificationsView({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const showToast = useToast();
  const [pending, startTransition] = React.useTransition();
  const unread = notifications.filter((n) => !n.read).length;

  function act(work: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const res = await work();
      if (!res.ok) showToast(res.message ?? "That didn't work.");
      else router.refresh();
    });
  }

  return (
    <div className="pb-8">
      <TopBar title="Notifications" />

      {notifications.length === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="When a scan finds a watched product at or below your target price, or a staple cheaper than you've ever seen it, it appears here."
          />
        </div>
      ) : (
        <>
          {unread > 0 ? (
            <div className="mb-3 px-5">
              {/* Clearing is not decoration: an unread alert is what stops the
                  same target price being announced again on the next scan. */}
              <Button
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => act(markNotificationsRead)}
              >
                Mark all {unread} as read
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 px-5">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex gap-2.5 rounded-(--radius-md) border border-line bg-white p-3.5 shadow-(--shadow-card) ${n.read ? "opacity-60" : ""}`}
              >
                <div
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: n.read ? "var(--color-line)" : notificationDotColor(n.kind) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold tracking-[0.07em] text-oak uppercase">
                    {notificationKindLabel(n.kind)}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold">{n.title}</div>
                  <div className="mt-0.5 text-xs text-muted">{n.body}</div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Dismiss ${n.title}`}
                  onClick={() => act(() => dismissNotification(n.id))}
                  className="shrink-0 cursor-pointer self-start text-[12px] font-semibold text-muted2 disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
