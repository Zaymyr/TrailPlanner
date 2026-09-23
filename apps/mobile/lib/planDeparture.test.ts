import { describe, expect, it } from 'vitest';

import { buildLocalDepartureAt, normalizePlanClock, readOrganizerStartTime } from './planDeparture';

describe('plan departure', () => {
  it('normalizes only unambiguous legacy clock values', () => {
    expect(normalizePlanClock('9h')).toBe('09:00');
    expect(normalizePlanClock('10h15')).toBe('10:15');
    expect(normalizePlanClock('11:10:00')).toBe('11:10');
    expect(normalizePlanClock('09:25 · 09:50')).toBeNull();
  });

  it('reads a single organizer departure and combines it with the race date', () => {
    const startTime = readOrganizerStartTime({ schedule: { startTime: '8h30' } });
    expect(buildLocalDepartureAt('2026-10-15', startTime)).toBe('2026-10-15T08:30:00');
  });
});
