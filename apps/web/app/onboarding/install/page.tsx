import { permanentRedirect } from "next/navigation";

export default function LegacyOnboardingInstallPage() {
  permanentRedirect("/race-planner");
}
