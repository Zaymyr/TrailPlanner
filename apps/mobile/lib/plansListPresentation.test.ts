import { describe, expect, it } from 'vitest';

import { formatDepartureCountdown, isPlanDeparturePast, sortPlanSections } from './plansListPresentation';
import type { PlanRow, RaceSection } from '../components/plans/types';

const nowMs = Date.parse('2026-11-01T10:00:00Z');

function plan(id: string, departureAt: string | null): PlanRow {
  return {
    id,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: id,
    race_id: id,
    planner_values: {},
    departureAt,
  };
}

function section(key: string, eventName: string, data: PlanRow[]): RaceSection {
  return { sectionKey: key, raceId: key, eventName, isOwned: false, data };
}

const countdownCopy = {
  notSet: 'Not set',
  passed: 'Started',
  inDays: (days: number) => `in ${days} d`,
  inHoursAndMinutes: (hours: number, minutes: number) => `in ${hours} h ${minutes} min`,
  inMinutesAndSeconds: (minutes: number, seconds: number) => `in ${minutes} min ${seconds} sec`,
};

describe('plans list presentation', () => {
  it('keeps a race active until the end of its local calendar day', () => {
    const afternoon = new Date(2026, 10, 1, 15, 1).getTime();
    expect(isPlanDeparturePast(new Date(2026, 10, 1, 8, 30).toISOString(), afternoon)).toBe(false);
    expect(isPlanDeparturePast(new Date(2026, 9, 31, 23, 30).toISOString(), afternoon)).toBe(true);
    expect(isPlanDeparturePast(null, afternoon)).toBe(false);
  });

  it('sorts sections and plans by upcoming departure, with undated plans before past ones', () => {
    const sections = sortPlanSections([
      section('later', 'Later', [plan('later', '2026-11-03T10:00:00Z')]),
      section('nearer', 'Nearer', [
        plan('past-in-nearer', '2026-10-30T10:00:00Z'),
        plan('undated', null),
        plan('nearer', '2026-11-02T10:00:00Z'),
      ]),
    ], nowMs, 'Past races');

    expect(sections.map((item) => item.sectionKey)).toEqual(['nearer', 'later']);
    expect(sections[0]?.data.map((item) => item.id)).toEqual(['nearer', 'undated', 'past-in-nearer']);
  });

  it('groups fully past sections last before the orphan section', () => {
    const sections = sortPlanSections([
      section('past-b', 'Past B', [plan('past-b', '2026-10-31T10:00:00Z')]),
      section('upcoming', 'Upcoming', [plan('upcoming', '2026-11-02T10:00:00Z')]),
      section('past-a', 'Past A', [plan('past-a', '2026-10-29T10:00:00Z')]),
      section('__orphan__', 'No race', [plan('orphan', null)]),
    ], nowMs, 'Past races');

    expect(sections.map((item) => item.sectionKey)).toEqual(['upcoming', '__past__', '__orphan__']);
    expect(sections[1]?.eventName).toBe('Past races');
    expect(sections[1]?.data.map((item) => item.id)).toEqual(['past-a', 'past-b']);
    expect(sections[1]?.pastEventStartIds).toEqual(['past-a', 'past-b']);
    expect(sections[1]?.pastEventNames).toEqual({ 'past-a': 'Past A', 'past-b': 'Past B' });
  });

  it('uses compact countdown copy at day, hour and minute granularity', () => {
    expect(formatDepartureCountdown('2026-11-13T10:00:00Z', nowMs, countdownCopy)).toBe('in 12 d');
    expect(formatDepartureCountdown('2026-11-02T07:04:00Z', nowMs, countdownCopy)).toBe('in 21 h 4 min');
    expect(formatDepartureCountdown('2026-11-01T10:04:44Z', nowMs, countdownCopy)).toBe('in 4 min 44 sec');
    expect(formatDepartureCountdown('2026-10-31T10:00:00Z', nowMs, countdownCopy)).toBe('Started');
  });
});
