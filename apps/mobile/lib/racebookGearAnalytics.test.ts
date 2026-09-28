import { describe, expect, it } from 'vitest';

import { buildRacebookGearToggleProperties } from './racebookGearAnalytics';
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
});
