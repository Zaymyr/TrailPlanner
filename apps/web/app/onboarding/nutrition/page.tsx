import { permanentRedirect } from "next/navigation";

export default function LegacyOnboardingNutritionPage() {
  permanentRedirect("/race-planner");
}
