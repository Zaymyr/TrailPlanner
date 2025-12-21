export type AidStation = { name: string; distanceKm: number };

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
};

export type Segment = {
  checkpoint: string;
  distanceKm: number;
  segmentKm: number;
  etaMinutes: number;
  segmentMinutes: number;
  fuelGrams: number;
  waterMl: number;
  sodiumMg: number;
  aidStationIndex?: number;
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
