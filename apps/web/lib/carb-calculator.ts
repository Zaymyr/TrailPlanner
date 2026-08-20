export type CarbEstimateInput = {
  durationHours: number;
  digestiveTolerance: number;
};

export type CarbEstimate = {
  carbsPerHour: number;
  totalCarbs: number;
  portionsPerHour: number;
  totalPortions: number;
  rangeMin: number;
  rangeMax: number;
};

const REFERENCE_PORTION_GRAMS = 25;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const interpolate = (start: number, end: number, progress: number) =>
  start + (end - start) * clamp(progress, 0, 1);

export function getCarbRangeForDuration(durationHours: number): { min: number; max: number } {
  if (durationHours < 0.75) return { min: 0, max: 0 };
  if (durationHours < 1) {
    return { min: 0, max: interpolate(0, 30, (durationHours - 0.75) / 0.25) };
  }
  if (durationHours <= 2.5) {
    return { min: 30, max: interpolate(30, 60, (durationHours - 1) / 1.5) };
  }

  return { min: 30, max: interpolate(60, 90, (durationHours - 2.5) / 3.5) };
}

export function estimateCarbs(input: CarbEstimateInput): CarbEstimate {
  const durationHours = Number.isFinite(input.durationHours) ? Math.max(0, input.durationHours) : 0;
  const digestiveTolerance = Number.isFinite(input.digestiveTolerance)
    ? clamp(input.digestiveTolerance, 0, 100)
    : 0;
  const range = getCarbRangeForDuration(durationHours);
  const carbsPerHour = Math.round(interpolate(range.min, range.max, digestiveTolerance / 100) / 5) * 5;
  const totalCarbs = Math.round(carbsPerHour * durationHours);

  return {
    carbsPerHour,
    totalCarbs,
    portionsPerHour: Number((carbsPerHour / REFERENCE_PORTION_GRAMS).toFixed(1)),
    totalPortions: Math.ceil(totalCarbs / REFERENCE_PORTION_GRAMS),
    rangeMin: Math.round(range.min / 5) * 5,
    rangeMax: Math.round(range.max / 5) * 5,
  };
}
