import { describe, expect, it } from 'vitest';

import { formatDepartureDelta, normalizePlanStartWaves } from './planRecapDeparture';

describe('plan recap departure', () => {
  it('formats the personal delta from the official start', () => {
    expect(formatDepartureDelta(new Date(2026, 0, 1, 8, 20), new Date(2026, 0, 1, 8, 0), 'fr'))
      .toBe('+20 min par rapport au départ officiel');
  });

  it('normalizes selectable waves and ignores invalid rows', () => {
    expect(normalizePlanStartWaves([
      { id: 'wave-1', name: 'Élite', start_time: '08:00:00' },
      { id: 'wave-2', name: 'Public', start_time: '8h20' },
      { id: 'wave-3', name: 'Invalide', start_time: null },
    ])).toEqual([
      { id: 'wave-1', name: 'Élite', startTime: '08:00' },
      { id: 'wave-2', name: 'Public', startTime: '08:20' },
    ]);
  });
});
