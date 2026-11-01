import { describe, expect, it } from 'vitest';

import {
  isExplicitRacebookFinishName,
  resolveRacebookFinishStation,
} from './racebookAidStationPresentation';

describe('RaceBook aid-station presentation', () => {
  it('uses a final explicitly named Arrivée as the finish even when its kilometer differs', () => {
    const arrival = { id: 'arrival', name: 'Arrivée', km: 186 };

    expect(resolveRacebookFinishStation([
      { id: 'ravito-11', name: 'Col du Grand', km: 172 },
      arrival,
    ])).toBe(arrival);
  });

  it('accepts the unaccented and English explicit finish labels', () => {
    expect(isExplicitRacebookFinishName(' ARRIVEE ')).toBe(true);
    expect(isExplicitRacebookFinishName('Finish')).toBe(true);
  });

  it('does not turn a nearby ordinary ravito into the finish', () => {
    const nearbyRavito = { id: 'ravito-12', name: 'Base de vie', km: 184.9 };

    expect(resolveRacebookFinishStation([
      { id: 'ravito-11', name: 'Col du Grand', km: 172 },
      nearbyRavito,
    ])).toBeNull();
  });

  it('does not use an earlier arrival marker when a later checkpoint remains', () => {
    expect(resolveRacebookFinishStation([
      { id: 'arrival', name: 'Arrivée', km: 185 },
      { id: 'last-ravito', name: 'Base de vie', km: 186 },
    ])).toBeNull();
  });
});
