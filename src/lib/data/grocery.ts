import { createClient } from "@/lib/supabase/server";

export type GroceryItem = {
  id: string;
  name: string;
  qty: string | null;
  category: "Meat" | "Dairy" | "Produce" | "Pantry" | "Frozen" | "Household" | "Other";
  checked: boolean;
  has_deal: boolean;
  retailer: { name: string } | null;
};

export async function getGroceryItems(householdId: string | null): Promise<GroceryItem[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("grocery_items")
      .select("id, name, qty, category, checked, has_deal, retailer:retailers(name)")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data as unknown as GroceryItem[];
  } catch {
    return [];
  }
}

