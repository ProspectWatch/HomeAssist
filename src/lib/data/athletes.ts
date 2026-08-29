import { createClient } from "@/lib/supabase/server";

export type Athlete = {
  id: string;
  name: string;
  sport: string | null;
};

export async function getAthletes(householdId: string | null): Promise<Athlete[]> {
  if (!householdId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("athletes")
      .select("id, name, sport")
      .eq("household_id", householdId)
      .order("name", { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export type AthleteEquipment = { id: string; equipment_type: string; item: string };

export async function getAthleteWithEquipment(
  householdId: string | null,
  athleteId: string,
): Promise<(Athlete & { equipment: AthleteEquipment[] }) | null> {
  if (!householdId) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("athletes")
      .select("id, name, sport, athlete_equipment(id, equipment_type, item)")
      .eq("household_id", householdId)
      .eq("id", athleteId)
      .maybeSingle();
    if (error || !data) return null;
    type Row = Athlete & { athlete_equipment: AthleteEquipment[] };
    const row = data as unknown as Row;
    return { id: row.id, name: row.name, sport: row.sport, equipment: row.athlete_equipment };
  } catch {
    return null;
  }
}
