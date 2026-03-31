import type { ElevationPoint, SectionSegment, SectionSubSegmentStats } from './profile-utils';
export type { ElevationPoint, SectionSegment, SectionSubSegmentStats, SegmentPreset } from './profile-utils';

export type PlanTarget = 'start' | number;
export type AccordionSection = 'course' | 'pace' | 'nutrition';

export type Supply = {
  productId: string;
  quantity: number;
};

export type AidStationFormItem = {
  id?: string;
  name: string;
  distanceKm: number;
  waterRefill: boolean;
  supplies?: Supply[];
};

export type FavProduct = {
  id: string;
  name: string;
  carbsGrams: number;
  sodiumMg: number;
};

export type PlanFormValues = {
  name: string;
  raceDistanceKm: number;
  elevationGain: number;
  paceType: 'pace' | 'speed';
  paceMinutes: number;
  paceSeconds: number;
  speedKph: number;
  targetIntakePerHour: number;
  waterIntakePerHour: number;
  sodiumIntakePerHour: number;
  waterBagLiters: number;
  startSupplies: Supply[];
  aidStations: AidStationFormItem[];
  sectionSegments?: Record<string, SectionSegment[]>;
};

export type PlanProduct = {
  id: string;
  name: string;
  fuel_type: string;
  carbs_g: number | null;
  sodium_mg: number | null;
  calories_kcal: number | null;
};

export type SectionTarget = {
  targetCarbsG: number;
  targetSodiumMg: number;
  targetWaterMl: number;
};

export type IntakeTimelineItem = {
  minute: number;
  label: string;
  detail: string;
  immediate?: boolean;
};

export type SectionSummary = {
  sectionIndex: number;
  startKm: number;
  endKm: number;
  distanceKm: number;
  durationMin: number;
  targetCarbsG: number;
  targetSodiumMg: number;
  targetWaterMl: number;
  profilePoints: ElevationPoint[];
  segments: SectionSegment[];
  segmentStats: SectionSubSegmentStats[];
  hasStoredSegments: boolean;
};

export type ProductBreakdownItem = {
  label: string;
  quantity: number;
};

export type PlanHighlights = {
  totalDurationLabel: string;
  totalProductUnits: number;
  distinctProductsCount: number;
  intermediateCount: number;
  plannedCarbsG: number;
  plannedSodiumMg: number;
  productBreakdown: ProductBreakdownItem[];
};

export const DEPART_ID = 'depart';
export const ARRIVEE_ID = 'arrivee';

export const FUEL_LABELS: Record<string, string> = {
  gel: 'GEL',
  drink_mix: 'BOISSON',
  electrolyte: 'ÉLEC',
  capsule: 'CAPS',
  bar: 'BARRE',
  real_food: 'ALIMENT',
  other: 'AUTRE',
};

export const DEFAULT_PLAN_VALUES: PlanFormValues = {
  name: '',
  raceDistanceKm: 0,
  elevationGain: 0,
  paceType: 'pace',
  paceMinutes: 6,
  paceSeconds: 0,
  speedKph: 10,
  targetIntakePerHour: 70,
  waterIntakePerHour: 500,
  sodiumIntakePerHour: 600,
  waterBagLiters: 1.5,
  startSupplies: [],
  aidStations: [],
};
