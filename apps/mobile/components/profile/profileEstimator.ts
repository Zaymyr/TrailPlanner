import type {
  CarbEstimatorLevel,
  EstimatedHourlyTargets,
  HydrationEstimatorLevel,
  SodiumEstimatorLevel,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function isValidWeightKg(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 20 && value <= 250;
}

export function isValidHeightCm(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 100 && value <= 250;
}

export function estimateHourlyTargets(params: {
  weightKg: number;
  heightCm: number;
  carbLevel: CarbEstimatorLevel;
  hydrationLevel: HydrationEstimatorLevel;
  sodiumLevel: SodiumEstimatorLevel;
}): EstimatedHourlyTargets {
  // Heuristic starting points inspired by endurance sports nutrition ranges:
  // carbs are kept within the common 30-90 g/h window, while water/sodium stay individualized and conservative.
  const { weightKg, heightCm, carbLevel, hydrationLevel, sodiumLevel } = params;

  let carbs = {
    beginner: 35,
    moderate: 45,
    gels: 60,
    high: 75,
  }[carbLevel];

  if (weightKg >= 90) carbs += 10;
  else if (weightKg >= 78) carbs += 5;
  else if (weightKg <= 55) carbs -= 5;

  if (heightCm >= 190) carbs += 5;
  else if (heightCm <= 162) carbs -= 5;

  carbs = clamp(roundToNearest(carbs, 5), 30, 90);

  let water = 550;
  if (weightKg >= 90) water += 150;
  else if (weightKg >= 75) water += 75;
  else if (weightKg <= 55) water -= 75;

  if (heightCm >= 190) water += 50;
  else if (heightCm <= 162) water -= 25;

  water += {
    low: -50,
    normal: 0,
    thirsty: 100,
    very_thirsty: 200,
  }[hydrationLevel];

  water = clamp(roundToNearest(water, 50), 350, 1000);

  const sodiumConcentrationMgPerLiter = {
    low: 500,
    normal: 700,
    salty: 900,
    very_salty: 1100,
  }[sodiumLevel];

  const sodium = clamp(
    roundToNearest((water / 1000) * sodiumConcentrationMgPerLiter, 50),
    250,
    1200,
  );

  return {
    carbsGPerHour: carbs,
    waterMlPerHour: water,
    sodiumMgPerHour: sodium,
  };
}
