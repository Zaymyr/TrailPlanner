import { permanentRedirect } from "next/navigation";

export default function LegacyOnboardingLoadingPage() {
  permanentRedirect("/race-planner");
}
