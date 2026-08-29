import { notFound } from "next/navigation";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getAthleteWithEquipment } from "@/lib/data/athletes";
import { getWatchItems } from "@/lib/data/watch";
import { AthleteProfileView } from "./athlete-profile-view";

export default async function AthleteProfilePage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const householdId = await getCurrentHouseholdId();
  const athlete = await getAthleteWithEquipment(householdId, athleteId);
  if (!athlete) notFound();

  const allWatch = await getWatchItems(householdId);
  const nextNeeds = allWatch.filter((w) => w.athlete_name === athlete.name);

  return <AthleteProfileView athlete={athlete} nextNeeds={nextNeeds} />;
}
