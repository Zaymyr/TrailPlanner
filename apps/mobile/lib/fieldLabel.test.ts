import { describe, expect, it } from 'vitest';

import { splitLabelUnit } from './fieldLabel';

describe('splitLabelUnit', () => {
  it('extracts a trailing unit', () => {
    expect(splitLabelUnit('Pause (min)')).toEqual({ label: 'Pause', unit: 'min' });
    expect(splitLabelUnit('Glucides (g/h)')).toEqual({ label: 'Glucides', unit: 'g/h' });
  });

  it('keeps the required marker', () => {
    expect(splitLabelUnit('Distance (km) *')).toEqual({ label: 'Distance *', unit: 'km' });
  });

  it('leaves labels without unit unchanged', () => {
    expect(splitLabelUnit('Nom')).toEqual({ label: 'Nom' });
    expect(splitLabelUnit('(km)')).toEqual({ label: '(km)' });
  });
});
