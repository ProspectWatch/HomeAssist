import { Users, Bell, ShieldCheck, HelpCircle, ChevronRight } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card } from "@/components/ui/card";

const LINKS = [
  { icon: Users, label: "Household members" },
  { icon: Bell, label: "Notifications" },
  { icon: ShieldCheck, label: "Privacy & data" },
  { icon: HelpCircle, label: "Help & support" },
] as const;

export default function MorePage() {
  return (
    <>
      <TopBar title="More" subtitle="Household, notifications, and settings." />
      <div className="flex flex-col gap-2 p-4">
        <Card className="divide-y divide-surface-100 overflow-hidden">
          {LINKS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-surface-900 hover:bg-surface-50"
            >
              <Icon className="h-5 w-5 text-surface-500" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-4 w-4 text-surface-300" aria-hidden="true" />
            </button>
          ))}
        </Card>
      </div>
    </>
  );
}
