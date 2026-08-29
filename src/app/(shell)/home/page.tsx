import { Home as HomeIcon, Eye, Sofa } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function HomePage() {
  return (
    <>
      <TopBar title="Welcome home" subtitle="Here's what's new for the Brown family." />
      <div className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile icon={Eye} label="Watching" value="—" />
          <SummaryTile icon={Sofa} label="Rooms" value="—" />
          <SummaryTile icon={HomeIcon} label="Members" value="—" />
        </div>

        <Card>
          <CardContent className="pt-4">
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Price drops and watch updates will show up here.</CardDescription>
            <div className="mt-4">
              <EmptyState
                title="Nothing to show yet"
                description="Once you start watching products, activity will appear here."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HomeIcon;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-1 p-3 text-center">
      <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
      <span className="text-lg font-semibold text-surface-900">{value}</span>
      <span className="text-xs text-surface-500">{label}</span>
    </Card>
  );
}
