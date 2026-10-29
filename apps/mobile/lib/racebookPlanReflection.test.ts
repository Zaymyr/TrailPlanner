import { describe, expect, it } from 'vitest';

import {
  estimatePersonalPassageMinute,
  LEGACY_AID_STATION_KM_TOLERANCE,
  matchPersonalAidStation,
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
