import { ShoppingBag, Plus } from "lucide-react";
import { TopBar } from "@/components/nav/top-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ShopPage() {
  return (
    <>
      <TopBar title="Shop" subtitle="Browse and add products to watch." />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <EmptyState
          icon={ShoppingBag}
          title="No products yet"
          description="Retailer browsing and search will land in a later phase. For now, add a product manually to start tracking it."
          action={
            <Button size="sm" variant="primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a product
            </Button>
          }
        />
      </div>
    </>
  );
}
