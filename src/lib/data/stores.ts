import { createClient } from "@/lib/supabase/server";

export type Store = { id: string; name: string; domain: string };

export type StoreLocation = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
};

export type StoreWithLocations = Store & {
  kind: string;
  locations: StoreLocation[];
};

/**
 * Retailers with their real branches.
 *
 * Locations come from OpenStreetMap and carry a real address; distance stays
 * absent because working it out needs the household's own position, and a
 * guessed distance is worse than none when the whole point is deciding
 * whether a trip is worth making.
 */
export async function getStoresWithLocations(): Promise<StoreWithLocations[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("retailers")
      .select("id, name, domain, kind, retailer_locations(id, name, address, city, postal_code, active)")
      .order("name");
    if (error || !data) return [];

    type Row = Store & {
      kind: string;
      retailer_locations: {
        id: string;
        name: string;
        address: string | null;
        city: string | null;
        postal_code: string | null;
        active: boolean;
      }[] | null;
    };

    return (data as unknown as Row[]).map((row) => ({
      id: row.id,
      name: row.name,
      domain: row.domain,
      kind: row.kind,
      locations: (row.retailer_locations ?? [])
        .filter((l) => l.active)
        .map((l) => ({
          id: l.id,
          name: l.name,
          address: l.address,
          city: l.city,
          postalCode: l.postal_code,
        }))
        .sort((a, b) => (a.address ?? a.name).localeCompare(b.address ?? b.name)),
    }));
  } catch {
    return [];
  }
}

export async function getStores(): Promise<Store[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("retailers").select("id, name, domain").order("name");
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}
