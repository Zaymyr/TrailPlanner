import { beforeEach, describe, expect, it } from 'vitest';

import {
  getRacebookScreenSnapshot,
  getRacebookScrollOffset,
  resetRacebookScreenMemoryForTests,
  setRacebookScreenSnapshot,
  setRacebookScrollOffset,
  type RacebookScreenSnapshot,
} from './racebookScreenMemory';

function snapshot(raceId: string) {
  return { data: { race: { id: raceId } } } as unknown as RacebookScreenSnapshot;
}

describe('racebookScreenMemory', () => {
  beforeEach(() => resetRacebookScreenMemoryForTests());

  it('keeps loaded snapshots isolated by race', () => {
    setRacebookScreenSnapshot('race-a', snapshot('race-a'));
    setRacebookScreenSnapshot('race-b', snapshot('race-b'));

    expect(getRacebookScreenSnapshot('race-a')?.data.race.id).toBe('race-a');
    expect(getRacebookScreenSnapshot('race-b')?.data.race.id).toBe('race-b');
    expect(getRacebookScreenSnapshot('race-c')).toBeNull();
  });

  it('keeps scroll offsets isolated by race, main tab and Course sub-tab', () => {
    setRacebookScrollOffset('race-a', 'course', 'aid-stations', 640);
    setRacebookScrollOffset('race-a', 'course', 'supporters', 210);
    setRacebookScrollOffset('race-a', 'gear', 'aid-stations', 95);

    expect(getRacebookScrollOffset('race-a', 'course', 'aid-stations')).toBe(640);
    expect(getRacebookScrollOffset('race-a', 'course', 'supporters')).toBe(210);
    expect(getRacebookScrollOffset('race-a', 'gear', 'route')).toBe(95);
    expect(getRacebookScrollOffset('race-b', 'course', 'aid-stations')).toBe(0);
  });

  it('normalizes invalid and negative offsets', () => {
    setRacebookScrollOffset('race-a', 'course', 'route', -20);
    setRacebookScrollOffset('race-a', 'course', 'route', Number.NaN);

    expect(getRacebookScrollOffset('race-a', 'course', 'route')).toBe(0);
  });
});
