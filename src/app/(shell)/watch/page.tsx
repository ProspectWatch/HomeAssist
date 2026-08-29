import { Eye } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { EmptyState } from "@/components/ui/empty-state";

export default function WatchPage() {
  return (
    <>
      <TopBar title="Watch" subtitle="Products you're tracking for price drops." />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <EmptyState
          icon={Eye}
          title="You're not watching anything yet"
          description="Add a product from Shop to start tracking its price here. Price history will appear once scanning is enabled in a later phase."
        />
      </div>
    </>
  );
}
