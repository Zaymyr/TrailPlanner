import { describe, expect, it } from 'vitest';

import {
  buildRacebookGearStateProperties,
  buildRacebookGearToggleProperties,
} from './racebookGearAnalytics';
import { getRacebookGearItemKey } from './racebookGearItemKey';

describe('buildRacebookGearToggleProperties', () => {
  it('returns bounded analytics metadata for a required item', () => {
    const item = {
      id: 'lamp-1',
      label: 'Lampe frontale',
      required: true,
      cold: false,
      heat: false,
      active: true,
    };

    expect(buildRacebookGearToggleProperties(
      [item],
      getRacebookGearItemKey('required', item),
      true,
    )).toEqual({
      action: 'checked',
      checked: true,
      gear_group: 'required',
      item_analytics_id: 'required:id:lamp-1',
      item_id: 'lamp-1',
      item_label: 'Lampe frontale',
      item_required: true,
      weather_context: 'none',
    });
  });

  it('classifies inactive weather equipment and records an uncheck', () => {
    const item = {
      id: null,
      label: 'Gants chauds',
      required: true,
      cold: true,
      heat: false,
      active: false,
    };

    expect(buildRacebookGearToggleProperties(
      [item],
      getRacebookGearItemKey('weather', item),
      false,
    )).toMatchObject({
      action: 'unchecked',
      checked: false,
      gear_group: 'weather',
      item_id: null,
      item_label: 'Gants chauds',
      weather_context: 'cold',
    });
  });

  it('returns null for a key that is no longer present in published equipment', () => {
    expect(buildRacebookGearToggleProperties([], 'required:id:removed', true)).toBeNull();
  });

  it('builds a complete checked and missing state snapshot', () => {
    const checkedItem = {
      id: 'whistle',
      label: 'Sifflet',
      required: true,
      cold: false,
      heat: false,
      active: true,
    };
    const missingItem = {
      id: 'jacket',
      label: 'Veste imperméable',
      required: false,
      cold: false,
      heat: false,
      active: true,
    };

    expect(buildRacebookGearStateProperties(
      [checkedItem, missingItem],
      new Set([getRacebookGearItemKey('required', checkedItem)]),
    )).toEqual([
      expect.objectContaining({
        checked: true,
        state: 'checked',
        item_analytics_id: 'required:id:whistle',
      }),
      expect.objectContaining({
        checked: false,
        state: 'missing',
        item_analytics_id: 'recommended:id:jacket',
      }),
    ]);
  });

  it('keeps fallback analytics identity free of the normalized label', () => {
    const item = {
      id: null,
      label: 'Gants très chauds',
      required: true,
      cold: true,
      heat: false,
      active: false,
    };

    const [properties] = buildRacebookGearStateProperties([item], new Set());

    expect(properties.item_analytics_id).toMatch(/^weather:label:[a-z0-9]+$/);
    expect(properties.item_analytics_id).not.toContain('gants');
  });
});
