import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getHouseholdSettings } from "@/lib/data/settings";
import { getHouseholdPeople } from "@/lib/data/people";
import { getStores } from "@/lib/data/stores";
import { getSiteUrl } from "@/lib/site-url";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const householdId = await getCurrentHouseholdId();
  const [settings, stores, people] = await Promise.all([
    getHouseholdSettings(householdId),
    getStores(),
    getHouseholdPeople(householdId),
  ]);
  return <SettingsView settings={settings} stores={stores} people={people} siteUrl={getSiteUrl()} />;
}
