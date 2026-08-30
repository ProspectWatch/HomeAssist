import { getStores } from "@/lib/data/stores";
import { OnboardingView } from "./onboarding-view";

export default async function OnboardingPage() {
  const stores = await getStores();
  return <OnboardingView stores={stores} />;
}
