import { permanentRedirect } from "next/navigation";

export default function LegacyOnboardingAccountPage() {
  permanentRedirect("/race-planner");
}
