import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getHouseholdSettings } from "@/lib/data/settings";
import { getStores } from "@/lib/data/stores";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const householdId = await getCurrentHouseholdId();
  const [settings, stores] = await Promise.all([
    getHouseholdSettings(householdId),
    getStores(),
  ]);
  return <SettingsView settings={settings} stores={stores} />;
}
