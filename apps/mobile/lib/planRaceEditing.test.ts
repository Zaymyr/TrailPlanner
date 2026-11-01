import { describe, expect, it } from 'vitest';

import { resolveAidStationEdit } from './planRaceEditing';

const current = {
  name: 'Ravito officiel',
  distanceKm: 18.4,
  waterRefill: true,
  solidRefill: true,
  assistanceAllowed: false,
  pauseMinutes: 2,
};
const proposed = {
  name: 'Nom modifié',
  distanceKm: 20,
  waterRefill: false,
  solidRefill: false,
  assistanceAllowed: true,
  pauseMinutes: 5,
};

describe('linked race plan editing', () => {
  it('keeps official station fields read-only while allowing the runner pause', () => {
    expect(resolveAidStationEdit(current, proposed, true)).toEqual({ ...current, pauseMinutes: 5 });
  });

  it('keeps full station editing for a plan without a race', () => {
    expect(resolveAidStationEdit(current, proposed, false)).toEqual(proposed);
  });
});
