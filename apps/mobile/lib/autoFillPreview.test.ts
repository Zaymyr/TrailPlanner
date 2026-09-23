import { describe, expect, it } from 'vitest';
import { buildAutoFillPreview, type AutoFillResult } from './autoFillPreview';
import type { AidStationFormItem } from '../components/plan-form/contracts';

const station = (name: string, supplies: AidStationFormItem['supplies']): AidStationFormItem => ({
  name,
  distanceKm: 10,
  waterRefill: true,
  solidRefill: false,
  assistanceAllowed: false,
  pauseMinutes: 0,
  supplies,
});

describe('buildAutoFillPreview', () => {
  it('counts units, references, supplied locations and changed locations', () => {
    const result: AutoFillResult = {
      startSupplies: [
        { productId: 'gel', quantity: 2 },
        { productId: 'bar', quantity: 1 },
      ],
      aidStations: [station('Ravito 1', []), station('Ravito 2', [{ productId: 'gel', quantity: 3 }])],
      unresolvedShortages: [],
    };

    expect(buildAutoFillPreview(result, [{ productId: 'gel', quantity: 1 }], [station('Ravito 1', []), station('Ravito 2', [])])).toEqual({
      totalUnits: 6,
      productCount: 2,
      locationCount: 2,
      changedLocationCount: 2,
      worstShortage: null,
    });
  });

  it('selects the most significant shortage for the compact warning', () => {
    const result: AutoFillResult = {
      startSupplies: [],
      aidStations: [],
      unresolvedShortages: [
        { sectionLabel: 'Départ → A', carbsG: 20, sodiumMg: 100 },
        { sectionLabel: 'A → B', carbsG: 5, sodiumMg: 500 },
      ],
    };

    expect(buildAutoFillPreview(result, [], []).worstShortage?.sectionLabel).toBe('A → B');
  });
});
