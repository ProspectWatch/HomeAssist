import { createClient } from "@/lib/supabase/server";

export type HouseholdSettings = {
  household_name: string;
  join_code: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  search_radii_km: Record<string, number>;
  preferred_retailer_ids: string[];
};

export async function getHouseholdSettings(householdId: string | null): Promise<HouseholdSettings | null> {
  if (!householdId) return null;
  try {
    const supabase = await createClient();
    const [{ data: household }, { data: settings }] = await Promise.all([
      supabase.from("households").select("name, join_code").eq("id", householdId).maybeSingle(),
      supabase
        .from("household_settings")
        .select("postal_code, city, province, country, search_radii_km, preferred_retailer_ids")
        .eq("household_id", householdId)
        .maybeSingle(),
    ]);

    return {
      household_name: household?.name ?? "",
      join_code: household?.join_code ?? null,
      postal_code: settings?.postal_code ?? null,
      city: settings?.city ?? null,
      province: settings?.province ?? null,
      country: settings?.country ?? null,
      search_radii_km: (settings?.search_radii_km as Record<string, number> | undefined) ?? {},
      preferred_retailer_ids: settings?.preferred_retailer_ids ?? [],
    };
  } catch {
    return null;
  }
}
