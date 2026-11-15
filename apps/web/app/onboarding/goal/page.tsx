import { permanentRedirect } from "next/navigation";

export default function LegacyOnboardingGoalPage() {
  permanentRedirect("/race-planner");
}
