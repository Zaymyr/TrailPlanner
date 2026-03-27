import { createClient } from "@supabase/supabase-js";
import type { Goal, EatingEase, SweatLevel } from "../contexts/OnboardingContext";
import type { NutritionPlan } from "./nutrition";

const LOCALSTORAGE_KEY = "pace_yourself_onboarding";

export type OnboardingPlanData = {
  distanceKm: number;
  elevationM: number;
  goal: Goal;
  eatingEase: EatingEase | null;
  sweatLevel: SweatLevel | null;
  carbsPerHour: number;
  waterPerHour: number;
  sodiumPerHour: number;
};

export function saveOnboardingToLocalStorage(data: OnboardingPlanData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
}

export function clearOnboardingFromLocalStorage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCALSTORAGE_KEY);
}

export function loadOnboardingFromLocalStorage(): OnboardingPlanData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCALSTORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingPlanData;
  } catch {
    return null;
  }
}

export async function saveOnboardingToSupabase(
  accessToken: string,
  data: OnboardingPlanData
): Promise<{ error: string | null }> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: "Supabase configuration is missing." };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { error: "Unable to identify user." };
  }

  const { error } = await supabase.from("nutrition_plans").insert({
    user_id: userData.user.id,
    distance_km: data.distanceKm,
    elevation_m: data.elevationM,
    goal: data.goal,
    eating_ease: data.eatingEase,
    sweat_level: data.sweatLevel,
    carbs_per_hour: data.carbsPerHour,
    water_per_hour: data.waterPerHour,
    sodium_per_hour: data.sodiumPerHour,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
