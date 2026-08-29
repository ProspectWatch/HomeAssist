import { createClient } from "@/lib/supabase/server";

export type Store = { id: string; name: string; domain: string };

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
