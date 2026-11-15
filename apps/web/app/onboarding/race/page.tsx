import { permanentRedirect } from "next/navigation";

export default function LegacyOnboardingRacePage() {
  permanentRedirect("/race-planner");
}
