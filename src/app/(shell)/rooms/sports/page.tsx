import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getAthletes } from "@/lib/data/athletes";
import { getWatchItems } from "@/lib/data/watch";
import { SportsView } from "./sports-view";

export default async function SportsPage() {
  const householdId = await getCurrentHouseholdId();
  const [athletes, allWatch] = await Promise.all([getAthletes(householdId), getWatchItems(householdId)]);
  const equipmentWatch = allWatch.filter((w) => w.department_key === "sports");
  const watchCountByAthlete = new Map<string, number>();
  for (const w of equipmentWatch) {
    if (!w.athlete_name) continue;
    const athlete = athletes.find((a) => a.name === w.athlete_name);
    if (athlete) watchCountByAthlete.set(athlete.id, (watchCountByAthlete.get(athlete.id) ?? 0) + 1);
  }

  return <SportsView athletes={athletes} watchCountByAthlete={watchCountByAthlete} equipmentWatch={equipmentWatch} />;
}
