import { describe, expect, it } from 'vitest';

import {
  estimatePersonalPassageMinute,
  estimatePersonalSegmentDuration,
  formatPersonalPassageClock,
  isPersonalPassageAfterCutoff,
  LEGACY_AID_STATION_KM_TOLERANCE,
  matchPersonalAidStation,
  normalizeSimpleClock,
  resolveCutoffMinuteAfterDeparture,
  normalizeAidStationNameForReflection,
  resolvePersonalAidStationTargetIndex,
} from './racebookPlanReflection';

describe('estimatePersonalPassageMinute', () => {
  const checkpoints = [
    { distanceKm: 0, arrivalMinute: 0, pauseMinutes: 0 },
    { distanceKm: 50, arrivalMinute: 300, pauseMinutes: 10 },
    { distanceKm: 100, arrivalMinute: 610, pauseMinutes: 0 },
  ];

  it('interpolates official passages between sparse personal checkpoints', () => {
    expect(estimatePersonalPassageMinute(25, checkpoints)).toBe(150);
    expect(estimatePersonalPassageMinute(75, checkpoints)).toBe(460);
  });

  it('keeps exact checkpoint arrivals and handles missing data', () => {
    expect(estimatePersonalPassageMinute(50, checkpoints)).toBe(300);
    expect(estimatePersonalPassageMinute(50, [])).toBeNull();
  });
});

describe('estimatePersonalSegmentDuration', () => {
  it('subtracts the previous checkpoint arrival and pause', () => {
    expect(estimatePersonalSegmentDuration(
      { arrivalMinute: 240 },
      { arrivalMinute: 150, pauseMinutes: 10 },
    )).toBe(80);
  });

  it('uses departure as the first segment origin', () => {
    expect(estimatePersonalSegmentDuration({ arrivalMinute: 75 }, null)).toBe(75);
    expect(estimatePersonalSegmentDuration(null, null)).toBeNull();
  });
});

describe('isPersonalPassageAfterCutoff', () => {
  it('detects a passage after a same-day cutoff', () => {
    expect(isPersonalPassageAfterCutoff('06:00', 185, '09:00')).toBe(true);
    expect(isPersonalPassageAfterCutoff('06:00', 175, '09:00')).toBe(false);
  });

  it('rolls an overnight cutoff after the departure day', () => {
    expect(isPersonalPassageAfterCutoff('18:00', 485, '02:00')).toBe(true);
    expect(isPersonalPassageAfterCutoff('18:00', 475, '02:00')).toBe(false);
  });

  it('ignores incomplete clock data', () => {
    expect(isPersonalPassageAfterCutoff(null, 200, '09:00')).toBe(false);
    expect(isPersonalPassageAfterCutoff('06:00', 200, 'matin')).toBe(false);
  });

  it('accepts legacy hour notation', () => {
    expect(isPersonalPassageAfterCutoff('6h', 181, '9h')).toBe(true);
  });

  it('compares a multi-day passage with the cutoff on the matching race day', () => {
    expect(isPersonalPassageAfterCutoff('06:00', 31 * 60, '12:00')).toBe(true);
    expect(isPersonalPassageAfterCutoff('06:00', 29 * 60, '12:00')).toBe(false);
  });
});

describe('multi-day RaceBook timing', () => {
  it('normalizes standalone organizer clocks to a consistent 24-hour representation', () => {
    expect(normalizeSimpleClock('9h')).toBe('09:00');
    expect(normalizeSimpleClock('9:00')).toBe('09:00');
    expect(normalizeSimpleClock('09:00')).toBe('09:00');
    expect(normalizeSimpleClock('10h15')).toBe('10:15');
  });

  it('formats overnight and multi-day planned passages without timezone-dependent dates', () => {
    expect(formatPersonalPassageClock('06:00', 180)).toBe('09:00');
    expect(formatPersonalPassageClock('23:30', 90)).toBe('J+1 · 01:00');
    expect(formatPersonalPassageClock('06:00', 43 * 60)).toBe('J+2 · 01:00');
  });

  it('resolves a cutoff to the closest chronological day around the passage anchor', () => {
    expect(resolveCutoffMinuteAfterDeparture('06:00', '12:00', 29 * 60)).toBe(30 * 60);
    expect(resolveCutoffMinuteAfterDeparture('06:00', '12:00', 31 * 60)).toBe(30 * 60);
    expect(resolveCutoffMinuteAfterDeparture('06:00', '12:00', 54 * 60)).toBe(54 * 60);
  });

  it('keeps incomplete or rich organizer clocks out of timing calculations', () => {
    expect(normalizeSimpleClock('samedi à 09:00')).toBeNull();
    expect(formatPersonalPassageClock('matin', 90)).toBeNull();
    expect(formatPersonalPassageClock('06:00', -1)).toBeNull();
    expect(resolveCutoffMinuteAfterDeparture('06:00', 'samedi à 09:00', 90)).toBeNull();
  });
});

describe('matchPersonalAidStation', () => {
  const official = { id: 'official-col', name: 'Col de l\'\u00c2ne', km: 22.4 };

  it('prioritizes the durable official source id over a legacy-looking name', () => {
    const match = matchPersonalAidStation(official, [
      { sourceAidStationId: 'another-station', name: "Col de l'\u00e2ne", distanceKm: 22.4 },
      { sourceAidStationId: 'official-col', name: 'Renomm\u00e9 par le coureur', distanceKm: 23 },
    ]);

    expect(match).toMatchObject({ index: 1, matchedBy: 'sourceAidStationId' });
  });

  it('uses normalized name and a bounded kilometer tolerance for legacy plans', () => {
    const match = matchPersonalAidStation(official, [
      { name: "  COL   DE L'ANE ", distanceKm: 22.4 + LEGACY_AID_STATION_KM_TOLERANCE },
    ]);

    expect(normalizeAidStationNameForReflection(" Col de l'\u00c2ne ")).toBe("col de l'ane");
    expect(match).toMatchObject({ index: 0, matchedBy: 'legacyNameAndKm' });
  });

  it('does not associate a same-name station outside the legacy kilometer tolerance', () => {
    expect(matchPersonalAidStation(official, [
      { name: "Col de l'\u00e2ne", distanceKm: 23 },
    ])).toBeNull();
  });

  it('does not use a mismatched persisted source id as a legacy fallback', () => {
    expect(matchPersonalAidStation(official, [
      { sourceAidStationId: 'previous-race-station', name: "Col de l'\u00e2ne", distanceKm: 22.4 },
    ])).toBeNull();
  });

  it('resolves legacy duplicates by closest kilometer then plan order', () => {
    const match = matchPersonalAidStation(official, [
      { name: "Col de l'\u00e2ne", distanceKm: 22.45 },
      { name: "Col de l'\u00e2ne", distanceKm: 22.45 },
      { name: "Col de l'\u00e2ne", distanceKm: 22.5 },
    ]);

    expect(match).toMatchObject({ index: 0, matchedBy: 'legacyNameAndKm' });
  });
});

describe('resolvePersonalAidStationTargetIndex', () => {
  it('prioritizes the official source id over a colliding local plan id', () => {
    expect(resolvePersonalAidStationTargetIndex([
      { id: 'official-col' },
      { id: 'local-col', sourceAidStationId: 'official-col' },
    ], 'official-col')).toBe(1);
  });

  it('falls back to the local plan id and reports an absent target', () => {
    const checkpoints = [{ id: 'local-col' }];
    expect(resolvePersonalAidStationTargetIndex(checkpoints, 'local-col')).toBe(0);
    expect(resolvePersonalAidStationTargetIndex(checkpoints, 'missing')).toBe(-1);
  });
});
