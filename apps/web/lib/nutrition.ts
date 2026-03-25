import type { Goal } from "../contexts/OnboardingContext";

export type NutritionPlan = {
  carbsPerHour: number;
  waterPerHour: number;
  sodiumPerHour: number;
};

export type Checkpoint = {
  km: number;
  carbs: number;
  water: number;
  sodium: number;
};

export function calculateNutrition(
  distance: number,
  elevation: number,
  goal: Goal
): NutritionPlan {
  let carbsPerHour = 60;
  if (elevation > 1000 || goal === "performance") {
    carbsPerHour += 10;
  }

  let waterPerHour = 500;
  if (elevation > 800) {
    waterPerHour += 150;
  }

  const sodiumPerHour = 400;

  return { carbsPerHour, waterPerHour, sodiumPerHour };
}

export function estimateRaceHours(distance: number, elevation: number): number {
  const basePaceMinPerKm = 8;
  const elevationPenaltyMin = elevation / 100;
  const totalMinutes = distance * basePaceMinPerKm + elevationPenaltyMin;
  return totalMinutes / 60;
}

export function getCheckpoints(
  distance: number,
  elevation: number,
  goal: Goal
): Checkpoint[] {
  const plan = calculateNutrition(distance, elevation, goal);
  const totalHours = estimateRaceHours(distance, elevation);

  return [0.25, 0.5, 0.75].map((fraction) => {
    const km = Math.round(distance * fraction);
    const hoursElapsed = totalHours * fraction;
    return {
      km,
      carbs: Math.round(plan.carbsPerHour * hoursElapsed),
      water: Math.round(plan.waterPerHour * hoursElapsed),
      sodium: Math.round(plan.sodiumPerHour * hoursElapsed),
    };
  });
}

export function getInsightMessage(distance: number, elevation: number, goal: Goal): string {
  const hours = estimateRaceHours(distance, elevation);
  const wallKm = Math.round(distance * 0.7);

  if (goal === "performance") {
    return `Tu éviteras le mur au km ${wallKm} grâce à une charge glucidique optimisée`;
  }
  if (hours > 6) {
    return `Tu éviteras le mur au km ${wallKm} avec un ravitaillement régulier`;
  }
  return `Tu éviteras le mur au km ${wallKm} en suivant ton plan`;
}
