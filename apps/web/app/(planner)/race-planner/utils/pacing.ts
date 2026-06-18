import type { FormValues } from "../types";

type PaceEffortInput = {
  distKm: number;
  dPlus: number;
  dMinus?: number;
  elapsedBeforeSeconds?: number;
  fatigueLevel?: number;
};

export const CLIMB_EQUIVALENT_METERS_PER_FLAT_KM = 100;
export const DESCENT_EQUIVALENT_METERS_PER_FLAT_KM = 300;
export const DEFAULT_FATIGUE_LEVEL = 0.5;

function clampFatigueLevel(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_FATIGUE_LEVEL;
  return Math.min(1, Math.max(0, value ?? DEFAULT_FATIGUE_LEVEL));
}

function computeFatigueSlowdown(elapsedSeconds: number | undefined, fatigueLevel: number | undefined) {
  const elapsedHours =
    typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds / 3600) : 0;
  const safeFatigueLevel = clampFatigueLevel(fatigueLevel);
  const fatigueStartHours = 10 - safeFatigueLevel * 6;
  const fatigueRampHours = 18 - safeFatigueLevel * 6;
  const maxSlowdown = 0.12 + safeFatigueLevel * 0.36;

  const progress = Math.min(1, Math.max(0, (elapsedHours - fatigueStartHours) / Math.max(1, fatigueRampHours)));
  const smoothProgress = progress * progress * (3 - 2 * progress);

  return maxSlowdown * smoothProgress;
}

function buildEffortDurationSeconds(baseSecondsPerKm: number, input: PaceEffortInput) {
  if (!Number.isFinite(baseSecondsPerKm) || baseSecondsPerKm <= 0) return 0;

  const safeDistanceKm = Number.isFinite(input.distKm) ? Math.max(0, input.distKm) : 0;
  const safeDPlus = Number.isFinite(input.dPlus) ? Math.max(0, input.dPlus) : 0;
  const safeDMinus = Number.isFinite(input.dMinus) ? Math.max(0, input.dMinus ?? 0) : 0;
  const equivalentKm =
    safeDistanceKm +
    safeDPlus / CLIMB_EQUIVALENT_METERS_PER_FLAT_KM +
    safeDMinus / DESCENT_EQUIVALENT_METERS_PER_FLAT_KM;
  const baseDurationSeconds = equivalentKm * baseSecondsPerKm;
  const fatigueReferenceSeconds = (input.elapsedBeforeSeconds ?? 0) + baseDurationSeconds / 2;
  const fatigueSlowdown = computeFatigueSlowdown(fatigueReferenceSeconds, input.fatigueLevel);

  return baseDurationSeconds * (1 + fatigueSlowdown);
}

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
  return buildEffortDurationSeconds(baseMinutesPerKm * 60, input) / 60;
}

export function estimateEffortDurationSeconds(
  baseSecondsPerKm: number,
  input: PaceEffortInput
) {
  return buildEffortDurationSeconds(baseSecondsPerKm, input);
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
