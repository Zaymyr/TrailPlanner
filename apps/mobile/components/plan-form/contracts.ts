export type { ElevationPoint, SectionSegment, SectionSubSegmentStats, SegmentPreset } from './profile-utils';

// Plan-timeline contracts are shared with the web planner chronology.
// Source of truth: packages/shared/src/plan-timeline/types.ts.
export type {
  AidStationFormItem,
  IntakeTimelineItem,
  PlanFormValues,
  PlanProduct,
  PlanTarget,
  SectionSummary,
  SectionTarget,
  Supply,
} from '../../../../packages/shared/src/plan-timeline/types';
export {
  ARRIVEE_ID,
  DEFAULT_FLUID_MIX_SHARE,
  DEFAULT_FLUID_PRODUCT_VOLUME_ML,
  DEFAULT_PLAN_VALUES,
  DEPART_ID,
} from '../../../../packages/shared/src/plan-timeline/types';

export type AccordionSection = 'course' | 'pace' | 'nutrition' | 'summary';

export type FavProduct = {
  id: string;
  name: string;
  carbsGrams: number;
  sodiumMg: number;
  fuelType?: string | null;
};

export type ProductBreakdownItem = {
  label: string;
  quantity: number;
};

export type PlanHighlights = {
  totalDurationMin: number;
  totalDurationLabel: string;
  totalProductUnits: number;
  distinctProductsCount: number;
  intermediateCount: number;
  plannedCarbsG: number;
  plannedSodiumMg: number;
  productBreakdown: ProductBreakdownItem[];
};

export const FUEL_LABELS: Record<string, string> = {
  gel: 'GEL',
  drink_mix: 'BOISSON',
  electrolyte: 'ÉLEC',
  capsule: 'CAPS',
  bar: 'BARRE',
  real_food: 'ALIMENT',
  other: 'AUTRE',
};
