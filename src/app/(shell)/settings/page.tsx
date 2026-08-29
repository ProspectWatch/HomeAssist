import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getHouseholdSettings } from "@/lib/data/settings";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const householdId = await getCurrentHouseholdId();
  const settings = await getHouseholdSettings(householdId);
  return <SettingsView settings={settings} />;
}
