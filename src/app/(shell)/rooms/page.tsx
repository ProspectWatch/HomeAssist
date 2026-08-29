import { Sofa, Plus } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function RoomsPage() {
  return (
    <>
      <TopBar title="Rooms" subtitle="Organize watched items by room." />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <EmptyState
          icon={Sofa}
          title="No rooms yet"
          description="Create a room — like Kitchen or Nursery — to group the items you're watching for it."
          action={
            <Button size="sm" variant="primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a room
            </Button>
          }
        />
      </div>
    </>
  );
}
