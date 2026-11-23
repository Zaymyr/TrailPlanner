import { describe, expect, it } from 'vitest';

import { DEFAULT_PLAN_VALUES, type PlanFormValues, type PlanProduct } from '../components/plan-form/contracts';
import { buildInitialPlanValues } from '../components/plan-form/helpers';
import type { ElevationPoint } from '../components/plan-form/profile-utils';
import {
  buildContinuousIntakeTimeline,
  buildContinuousSections,
  buildSectionTimelineFromContinuous,
  buildSuggestedSolidIntakePlan,
} from './continuousNutrition';
import { compactPlanTimeline } from './planTimelinePresentation';

// Golden fixtures: the chronology engine lives in packages/shared/src/plan-timeline and is shared
// with the web planner. These snapshots pin the mobile output so any engine change is deliberate.

const products: PlanProduct[] = [
  { id: 'gel', name: 'Gel 25', fuel_type: 'gel', carbs_g: 25, sodium_mg: 50, calories_kcal: 100 },
  { id: 'bar', name: 'Barre 40', fuel_type: 'bar', carbs_g: 40, sodium_mg: 120, calories_kcal: 200 },
  { id: 'drink', name: 'Boisson 30', fuel_type: 'drink_mix', carbs_g: 30, sodium_mg: 300, calories_kcal: 120 },
  { id: 'salt', name: 'Electrolytes', fuel_type: 'electrolyte', carbs_g: 0, sodium_mg: 500, calories_kcal: 0 },
];
const productMap = Object.fromEntries(products.map((product) => [product.id, product]));

const elevationProfile: ElevationPoint[] = Array.from({ length: 41 }, (_, index) => ({
  distanceKm: index,
  elevationM: 500 + Math.round(400 * Math.sin(index / 6)),
}));

function buildValues(overrides: Partial<PlanFormValues>): PlanFormValues {
  return buildInitialPlanValues({ ...DEFAULT_PLAN_VALUES, ...overrides });
}

const fullValues = buildValues({
  name: 'Golden',
  raceDistanceKm: 40,
  elevationGain: 1800,
  fatigueLevel: 0.6,
  paceMinutes: 7,
  paceSeconds: 30,
  targetIntakePerHour: 70,
  waterIntakePerHour: 550,
  sodiumIntakePerHour: 600,
  waterBagLiters: 1.5,
  startSupplies: [
    { productId: 'gel', quantity: 3 },
    { productId: 'drink', quantity: 1 },
  ],
  aidStations: [
    { name: 'Col', distanceKm: 12, waterRefill: true, pauseMinutes: 3, supplies: [{ productId: 'bar', quantity: 2 }, { productId: 'salt', quantity: 1 }] },
    { name: 'Source', distanceKm: 21, waterRefill: false, supplies: [{ productId: 'gel', quantity: 2 }] },
    { name: 'Refuge', distanceKm: 31, waterRefill: true, assistanceAllowed: false, supplies: [{ productId: 'bar', quantity: 4 }] },
  ],
  sectionSegments: {
    'section-1': [
      { segmentKm: 4, label: 'Montée', paceAdjustmentMinutesPerKm: 1.5 },
      { segmentKm: 5, label: 'Descente' },
    ],
  },
});

const waterOnlyValues = buildValues({
  name: 'Water only',
  raceDistanceKm: 18,
  elevationGain: 600,
  paceType: 'speed',
  speedKph: 9,
  aidStations: [{ name: 'Ravito', distanceKm: 9, waterRefill: true }],
});

function snapshotPlan(values: PlanFormValues, profile: ElevationPoint[], interval?: 5 | 10 | 15) {
  const sections = buildContinuousSections({ values, elevationProfile: profile });
  const timeline = buildContinuousIntakeTimeline({
    values,
    productMap,
    elevationProfile: profile,
    waterOnlyReminderIntervalMinutes: interval,
  });
  return {
    sections,
    timeline,
    sectionTimelines: sections.map((section) =>
      compactPlanTimeline(buildSectionTimelineFromContinuous(timeline, section)),
    ),
  };
}

describe('continuous nutrition engine (golden)', () => {
  it('keeps the full plan chronology stable', () => {
    expect(snapshotPlan(fullValues, elevationProfile)).toMatchSnapshot();
  });

  it('keeps the plan chronology stable without an elevation profile', () => {
    expect(snapshotPlan(fullValues, [])).toMatchSnapshot();
  });

  it('keeps water-only reminders stable', () => {
    expect(snapshotPlan(waterOnlyValues, [])).toMatchSnapshot();
    expect(snapshotPlan(waterOnlyValues, [], 15)).toMatchSnapshot();
  });

  it('keeps the suggested solid intake plan stable', () => {
    expect(
      buildSuggestedSolidIntakePlan({
        values: fullValues,
        elevationProfile,
        solidProducts: [
          { id: 'gel', name: 'Gel 25', carbs_g: 25, sodium_mg: 50 },
          { id: 'bar', name: 'Barre 40', carbs_g: 40, sodium_mg: 120 },
        ],
      }).events,
    ).toMatchSnapshot();
  });
});
