import type { Goal } from "../contexts/OnboardingContext";
import { calculateNutrition } from "./nutrition";

export type CarbEstimateInput = {
  durationHours: number;
  distanceKm: number;
  elevationGainM: number;
  goal: Goal;
};

export type CarbEstimate = {
  carbsPerHour: number;
  totalCarbs: number;
  portionsPerHour: number;
  totalPortions: number;
};

const REFERENCE_PORTION_GRAMS = 25;

export function estimateCarbs(input: CarbEstimateInput): CarbEstimate {
  const durationHours = Number.isFinite(input.durationHours) ? Math.max(0, input.durationHours) : 0;
  const distanceKm = Number.isFinite(input.distanceKm) ? Math.max(0, input.distanceKm) : 0;
  const elevationGainM = Number.isFinite(input.elevationGainM) ? Math.max(0, input.elevationGainM) : 0;
  const { carbsPerHour } = calculateNutrition(distanceKm, elevationGainM, input.goal);
  const totalCarbs = Math.round(carbsPerHour * durationHours);

  return {
    carbsPerHour,
    totalCarbs,
    portionsPerHour: Number((carbsPerHour / REFERENCE_PORTION_GRAMS).toFixed(1)),
    totalPortions: Math.ceil(totalCarbs / REFERENCE_PORTION_GRAMS),
  };
}
