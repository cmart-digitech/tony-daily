import { redirect } from "next/navigation";
import OnboardingFlow from "@/components/OnboardingFlow";
import { isMarketDataConfigured } from "@/lib/market";
import { getPreferences } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const prefs = await getPreferences();
  if (prefs.onboarded) redirect("/");
  return <OnboardingFlow marketConfigured={isMarketDataConfigured()} />;
}
