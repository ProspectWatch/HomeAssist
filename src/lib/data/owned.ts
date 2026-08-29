import { createClient } from "@/lib/supabase/server";

export type OwnedProduct = {
  id: string;
  name: string;
  purchase_date: string | null;
  purchase_price_cents: number | null;
  warranty_until: string | null;
  retailer_name: string | null;
  serial: string | null;
};

export async function getOwnedProducts(
  householdId: string | null,
  departmentKey?: string,
): Promise<OwnedProduct[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    let query = supabase
      .from("owned_products")
      .select("id, name, purchase_date, purchase_price_cents, warranty_until, serial, retailer:retailers(name)")
      .eq("household_id", householdId);
    if (departmentKey) query = query.eq("department_key", departmentKey);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error || !data) return [];
    type Row = Omit<OwnedProduct, "retailer_name"> & { retailer: { name: string } | null };
    return (data as unknown as Row[]).map((r) => ({ ...r, retailer_name: r.retailer?.name ?? null }));
  } catch {
    return [];
  }
}
