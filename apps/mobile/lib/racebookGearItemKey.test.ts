import { describe, expect, it } from 'vitest';

import {
  countMissingRequiredRacebookGearItems,
  getRacebookGearItemKey,
} from './racebookGearItemKey';

describe('countMissingRequiredRacebookGearItems', () => {
  const requiredItem = {
    id: 'required',
    label: 'Couverture de survie',
    active: true,
    required: true,
  };

  it('counts only active required items that are not checked', () => {
    const checkedItem = {
      id: 'checked',
      label: 'Téléphone chargé',
      active: true,
      required: true,
    };

    expect(
      countMissingRequiredRacebookGearItems(
        [
          requiredItem,
          checkedItem,
          { id: 'recommended', label: 'Casquette', active: true, required: false },
          { id: 'inactive-weather', label: 'Gants chauds', active: false, required: true },
        ],
        new Set([getRacebookGearItemKey('required', checkedItem)]),
      ),
    ).toBe(1);
  });

  it('includes required weather equipment when its weather plan is active', () => {
    const activeWeatherItem = {
      id: 'active-weather',
      label: 'Gants chauds',
      active: true,
      required: true,
    };

    expect(
      countMissingRequiredRacebookGearItems(
        [requiredItem, activeWeatherItem],
        new Set([getRacebookGearItemKey('required', requiredItem)]),
      ),
    ).toBe(1);
  });
});
