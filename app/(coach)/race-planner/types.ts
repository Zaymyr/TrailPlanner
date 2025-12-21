export type SegmentPlan = {
  segmentMinutesOverride?: number;
  gelsPlanned?: number;
  pickupGels?: number;
};

export type AidStation = { name: string; distanceKm: number } & SegmentPlan;

export type FormValues = {
  raceDistanceKm: number;
  elevationGain: number;
  paceType: "pace" | "speed";
  paceMinutes: number;
  paceSeconds: number;
  speedKph: number;
  uphillEffort: number;
  downhillEffort: number;
  targetIntakePerHour: number;
  waterIntakePerHour: number;
  sodiumIntakePerHour: number;
  aidStations: AidStation[];
  finishPlan?: SegmentPlan;
};

export type Segment = {
  checkpoint: string;
  from: string;
  startDistanceKm: number;
  distanceKm: number;
  segmentKm: number;
  etaMinutes: number;
  segmentMinutes: number;
  estimatedSegmentMinutes: number;
  fuelGrams: number;
  waterMl: number;
  sodiumMg: number;
  plannedFuelGrams: number;
  plannedWaterMl: number;
  plannedSodiumMg: number;
  targetFuelGrams: number;
  targetWaterMl: number;
  targetSodiumMg: number;
  gelsPlanned: number;
  recommendedGels: number;
  plannedMinutesOverride?: number;
  pickupGels?: number;
  aidStationIndex?: number;
  isFinish?: boolean;
};

export type ElevationPoint = { distanceKm: number; elevationM: number };
export type SpeedSample = { distanceKm: number; speedKph: number };
export type GelOption = { slug: string; name: string; carbs: number; sodium: number };

export type SavedPlan = {
  id: string;
  name: string;
  updatedAt: string;
  plannerValues: Partial<FormValues>;
  elevationProfile: ElevationPoint[];
};
