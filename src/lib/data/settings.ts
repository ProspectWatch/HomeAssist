import { createClient } from "@/lib/supabase/server";

export type HouseholdSettings = {
  postal_code: string | null;
  city: string | null;
  search_radii_km: Record<string, number>;
  preferred_retailer_name: string | null;
};

export async function getHouseholdSettings(householdId: string | null): Promise<HouseholdSettings | null> {
  if (!householdId) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("household_settings")
      .select("postal_code, city, search_radii_km, preferred_retailer:retailers(name)")
      .eq("household_id", householdId)
      .maybeSingle();
    if (error) return null;
    if (!data) return { postal_code: null, city: null, search_radii_km: {}, preferred_retailer_name: null };
    type Row = { postal_code: string | null; city: string | null; search_radii_km: Record<string, number>; preferred_retailer: { name: string } | null };
    const row = data as unknown as Row;
    return {
      postal_code: row.postal_code,
      city: row.city,
      search_radii_km: row.search_radii_km ?? {},
      preferred_retailer_name: row.preferred_retailer?.name ?? null,
    };
  } catch {
    return null;
  }
}
