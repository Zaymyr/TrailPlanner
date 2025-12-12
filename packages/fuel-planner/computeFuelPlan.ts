export type PaceBasedTarget = {
  type: 'pace';
  /** Minutes per kilometer */
  minutesPerKm: number;
};

export type SpeedBasedTarget = {
  type: 'speed';
  /** Kilometers per hour */
  speedKmh: number;
};

export type EffortTarget = PaceBasedTarget | SpeedBasedTarget;

export type AidStation = {
  name: string;
  /** Distance from start in kilometers */
  distanceKm: number;
};

export type IntakeRates = {
  /** grams of carbohydrates per hour */
  carbsPerHour?: number;
  /** milliliters of fluids per hour */
  fluidsPerHour?: number;
  /** milligrams of sodium per hour */
  sodiumPerHour?: number;
};

export type Label = {
  en: string;
  fr: string;
};

export type SegmentIntake = {
  carbsGrams?: number;
  fluidsMl?: number;
  sodiumMg?: number;
};

export type FuelSegment = {
  fromKm: number;
  toKm: number;
  distanceKm: number;
  durationMinutes: number;
  cumulativeMinutes: number;
  eta?: string;
  label: Label;
  intake?: SegmentIntake;
};

export type FuelPlanInput = {
  distanceKm: number;
  startTime?: string | Date;
  effort: EffortTarget;
  aidStations?: AidStation[];
  intakeRates?: IntakeRates;
};

export type FuelPlanTotals = SegmentIntake & {
  totalHours: number;
};

export type FuelPlan = {
  segments: FuelSegment[];
  totals: FuelPlanTotals;
};

const START_LABEL: Label = { en: 'Start', fr: 'Départ' };
const FINISH_LABEL: Label = { en: 'Finish', fr: 'Arrivée' };

const roundTo = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const computeMinutesPerKm = (effort: EffortTarget): number => {
  if (effort.type === 'pace') {
    if (effort.minutesPerKm <= 0) {
      throw new Error('Pace must be positive');
    }
    return effort.minutesPerKm;
  }

  if (effort.speedKmh <= 0) {
    throw new Error('Speed must be positive');
  }

  return 60 / effort.speedKmh;
};

const sortedAidStations = (aidStations: AidStation[], distanceKm: number): AidStation[] =>
  [...aidStations]
    .filter((station) => station.distanceKm > 0 && station.distanceKm < distanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

const buildStops = (distanceKm: number, aidStations: AidStation[]): { distanceKm: number; label: Label }[] => {
  const stations = sortedAidStations(aidStations, distanceKm);

  const stops: { distanceKm: number; label: Label }[] = [
    { distanceKm: 0, label: START_LABEL },
    ...stations.map((station) => ({ distanceKm: station.distanceKm, label: { en: station.name, fr: station.name } })),
    { distanceKm: distanceKm, label: FINISH_LABEL }
  ];

  return stops;
};

const computeSegmentIntake = (durationMinutes: number, intakeRates?: IntakeRates): SegmentIntake | undefined => {
  if (!intakeRates) return undefined;

  const durationHours = durationMinutes / 60;
  const intake: SegmentIntake = {};

  if (typeof intakeRates.carbsPerHour === 'number') {
    intake.carbsGrams = Math.round(intakeRates.carbsPerHour * durationHours);
  }

  if (typeof intakeRates.fluidsPerHour === 'number') {
    intake.fluidsMl = Math.round(intakeRates.fluidsPerHour * durationHours);
  }

  if (typeof intakeRates.sodiumPerHour === 'number') {
    intake.sodiumMg = Math.round(intakeRates.sodiumPerHour * durationHours);
  }

  return Object.keys(intake).length ? intake : undefined;
};

const computeSegmentLabel = (from: Label, to: Label): Label => ({
  en: `${from.en} → ${to.en}`,
  fr: `${from.fr} → ${to.fr}`
});

export const computeFuelPlan = (input: FuelPlanInput): FuelPlan => {
  const { distanceKm, startTime, effort, aidStations = [], intakeRates } = input;

  if (distanceKm <= 0) {
    throw new Error('Distance must be positive');
  }

  const minutesPerKm = computeMinutesPerKm(effort);
  const stops = buildStops(distanceKm, aidStations);

  const baseTime = startTime ? new Date(startTime) : undefined;
  const segments: FuelSegment[] = [];
  let cumulativeMinutes = 0;

  for (let i = 0; i < stops.length - 1; i += 1) {
    const from = stops[i];
    const to = stops[i + 1];
    const segmentDistance = to.distanceKm - from.distanceKm;

    const durationMinutes = roundTo(segmentDistance * minutesPerKm, 1);
    cumulativeMinutes = roundTo(cumulativeMinutes + durationMinutes, 1);

    const eta = baseTime ? new Date(baseTime.getTime() + cumulativeMinutes * 60 * 1000).toISOString() : undefined;

    const intake = computeSegmentIntake(durationMinutes, intakeRates);

    segments.push({
      fromKm: from.distanceKm,
      toKm: to.distanceKm,
      distanceKm: roundTo(segmentDistance, 2),
      durationMinutes,
      cumulativeMinutes,
      eta,
      label: computeSegmentLabel(from.label, to.label),
      intake
    });
  }

  const totalHours = roundTo(cumulativeMinutes / 60, 3);
  const totals: FuelPlanTotals = { totalHours };

  if (intakeRates) {
    const aggregate: SegmentIntake = {};
    segments.forEach((segment) => {
      if (segment.intake?.carbsGrams) {
        aggregate.carbsGrams = (aggregate.carbsGrams ?? 0) + segment.intake.carbsGrams;
      }
      if (segment.intake?.fluidsMl) {
        aggregate.fluidsMl = (aggregate.fluidsMl ?? 0) + segment.intake.fluidsMl;
      }
      if (segment.intake?.sodiumMg) {
        aggregate.sodiumMg = (aggregate.sodiumMg ?? 0) + segment.intake.sodiumMg;
      }
    });

    if (Object.keys(aggregate).length) {
      totals.carbsGrams = aggregate.carbsGrams;
      totals.fluidsMl = aggregate.fluidsMl;
      totals.sodiumMg = aggregate.sodiumMg;
    }
  }

  return { segments, totals };
};
