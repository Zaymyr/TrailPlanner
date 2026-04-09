import type { FormValues } from "../types";

type PaceEffortInput = {
  distKm: number;
  dPlus: number;
};

export const CLIMB_EQUIVALENT_METERS_PER_FLAT_KM = 100;

export function minutesPerKm(values: FormValues): number | null {
  if (values.paceType === "speed") {
    if (values.speedKph <= 0) return null;
    return 60 / values.speedKph;
  }
  return values.paceMinutes + values.paceSeconds / 60;
}

export function paceToSpeedKph(paceMinutes: number, paceSeconds: number) {
  const totalMinutes = paceMinutes + paceSeconds / 60;
  if (totalMinutes <= 0) return null;
  return 60 / totalMinutes;
}

export function speedToPace(speedKph: number) {
  if (speedKph <= 0) return null;
  const totalMinutes = 60 / speedKph;
  const minutes = Math.floor(totalMinutes);
  let seconds = Math.round((totalMinutes - minutes) * 60);
  if (seconds === 60) {
    return { minutes: minutes + 1, seconds: 0 };
  }
  return { minutes, seconds };
}

export function equivalentFlatDistanceKm({ distKm, dPlus }: PaceEffortInput) {
  const safeDistanceKm = Number.isFinite(distKm) ? Math.max(0, distKm) : 0;
  const safeDPlus = Number.isFinite(dPlus) ? Math.max(0, dPlus) : 0;

  return safeDistanceKm + safeDPlus / CLIMB_EQUIVALENT_METERS_PER_FLAT_KM;
}

export function estimateEffortDurationMinutes(
  baseMinutesPerKm: number,
  input: PaceEffortInput
) {
  if (!Number.isFinite(baseMinutesPerKm) || baseMinutesPerKm <= 0) return 0;
  return equivalentFlatDistanceKm(input) * baseMinutesPerKm;
}

export function estimateEffortDurationSeconds(
  baseSecondsPerKm: number,
  input: PaceEffortInput
) {
  if (!Number.isFinite(baseSecondsPerKm) || baseSecondsPerKm <= 0) return 0;
  return equivalentFlatDistanceKm(input) * baseSecondsPerKm;
}

export function adjustedPaceMinutesPerKm(
  baseMinutesPerKm: number,
  input: PaceEffortInput
) {
  const safeDistanceKm = Number.isFinite(input.distKm) ? Math.max(0, input.distKm) : 0;
  if (!Number.isFinite(baseMinutesPerKm) || baseMinutesPerKm <= 0) return null;
  if (safeDistanceKm <= 0) return baseMinutesPerKm;

  return estimateEffortDurationMinutes(baseMinutesPerKm, input) / safeDistanceKm;
}
