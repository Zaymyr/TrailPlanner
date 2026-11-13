import { permanentRedirect } from "next/navigation";

export default function LegacyOnboardingNutritionFoodPage() {
  permanentRedirect("/race-planner");
}
