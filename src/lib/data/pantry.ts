import { createClient } from "@/lib/supabase/server";

export type PantryProduct = {
  id: string;
  title: string;
  package_detail: string | null;
  target_price_cents: number | null;
  stock_status: "good" | "low" | null;
  image_url: string | null;
  retailer: { name: string } | null;
};

/** Products flagged as a household's "regular buy" for a given department (kitchen = Pantry screen). */
export async function getRegularBuys(
  householdId: string | null,
  departmentKey: string,
): Promise<PantryProduct[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, title, package_detail, target_price_cents, stock_status, image_url, retailer:retailers(name)")
      .eq("household_id", householdId)
      .eq("department_key", departmentKey)
      .eq("is_regular_buy", true)
      .order("title", { ascending: true });
    if (error || !data) return [];
    return data as unknown as PantryProduct[];
  } catch {
    return [];
  }
}
