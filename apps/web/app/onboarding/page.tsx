import { permanentRedirect } from "next/navigation";

export default function LegacyOnboardingPage() {
  permanentRedirect("/race-planner");
}
