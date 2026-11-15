import { describe, expect, it } from 'vitest';

import {
  collectStoredPlanProductIds,
  computePlanReadiness,
  hasAidStations,
  hasPlannedTime,
  type ReadinessProduct,
  type StoredPlannerValues,
} from './planReadiness';

const products: Record<string, ReadinessProduct> = {
  gel: { id: 'gel', name: 'Gel', fuel_type: 'gel', carbs_g: 25, sodium_mg: 50 },
  caps: { id: 'caps', name: 'Caps', fuel_type: 'capsule', carbs_g: 0, sodium_mg: 250 },
};

const fullSupplies = [
  { productId: 'gel', quantity: 6 },
  { productId: 'caps', quantity: 3 },
];

function plan(overrides: Partial<StoredPlannerValues> = {}): StoredPlannerValues {
  return {
    raceDistanceKm: 20,
    elevationGain: 0,
    paceType: 'pace',
    paceMinutes: 6,
    paceSeconds: 0,
    speedKph: 10,
    targetIntakePerHour: 60,
    sodiumIntakePerHour: 500,
    waterIntakePerHour: 500,
    waterBagLiters: 1.5,
    startSupplies: fullSupplies,
    aidStations: [{ name: 'Ravito 1', distanceKm: 10, waterRefill: true, supplies: fullSupplies }],
    ...overrides,
  };
}

describe('hasPlannedTime', () => {
  it('needs a distance and a pace or speed', () => {
    expect(hasPlannedTime(plan())).toBe(true);
    expect(hasPlannedTime(plan({ raceDistanceKm: 0 }))).toBe(false);
    expect(hasPlannedTime(plan({ paceType: undefined, paceMinutes: undefined, speedKph: undefined }))).toBe(false);
    expect(hasPlannedTime(plan({ paceType: 'speed', speedKph: 9 }))).toBe(true);
    expect(hasPlannedTime(plan({ paceType: 'speed', speedKph: 0 }))).toBe(false);
  });
});

describe('hasAidStations', () => {
  it('ignores the system start and finish stations', () => {
    expect(hasAidStations(plan())).toBe(true);
    expect(hasAidStations(plan({ aidStations: [{ name: 'Départ', distanceKm: 0 }, { name: 'Arrivée', distanceKm: 20 }] }))).toBe(false);
    expect(hasAidStations(plan({ aidStations: [] }))).toBe(false);
  });
});

describe('computePlanReadiness', () => {
  it('is a draft without planned time or aid stations', () => {
    expect(computePlanReadiness(null, null, products)).toBe('draft');
    expect(computePlanReadiness(plan({ raceDistanceKm: 0 }), null, products)).toBe('draft');
    expect(computePlanReadiness(plan({ aidStations: [] }), null, products)).toBe('draft');
  });

  it('is ready when every carbohydrate, sodium and water gauge is at least orange', () => {
    expect(computePlanReadiness(plan(), null, products)).toBe('ready');
  });

  it('is in progress when no supply is planned (red gauges)', () => {
    expect(
      computePlanReadiness(
        plan({ startSupplies: [], aidStations: [{ name: 'Ravito 1', distanceKm: 10, supplies: [] }] }),
        null,
        products,
      ),
    ).toBe('inProgress');
  });

  it('is in progress when only sodium is short', () => {
    const gelsOnly = [{ productId: 'gel', quantity: 6 }];
    expect(
      computePlanReadiness(
        plan({ sodiumIntakePerHour: 2000, startSupplies: gelsOnly, aidStations: [{ name: 'Ravito 1', distanceKm: 10, supplies: gelsOnly }] }),
        null,
        products,
      ),
    ).toBe('inProgress');
  });

  it('is in progress when the water bag cannot cover the water target', () => {
    expect(computePlanReadiness(plan({ waterBagLiters: 0.2 }), null, products)).toBe('inProgress');
  });

  it('stays in progress until product nutrition is loaded', () => {
    expect(computePlanReadiness(plan(), null, null)).toBe('inProgress');
  });

  it('treats a gauge without target as met', () => {
    expect(
      computePlanReadiness(
        plan({ waterIntakePerHour: 0, sodiumIntakePerHour: 0, startSupplies: [{ productId: 'gel', quantity: 6 }], aidStations: [{ name: 'R', distanceKm: 10, supplies: [{ productId: 'gel', quantity: 6 }] }] }),
        null,
        products,
      ),
    ).toBe('ready');
  });
});

describe('collectStoredPlanProductIds', () => {
  it('lists start and aid-station products once', () => {
    expect(collectStoredPlanProductIds(plan()).sort()).toEqual(['caps', 'gel']);
  });
});
