import { permanentRedirect } from "next/navigation";

export default function LegacyOnboardingImprovePage() {
  permanentRedirect("/race-planner");
}
