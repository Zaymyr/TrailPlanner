import { permanentRedirect } from "next/navigation";

export default function LegacyOnboardingResultPage() {
  permanentRedirect("/race-planner");
}
