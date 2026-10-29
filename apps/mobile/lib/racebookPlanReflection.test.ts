import { describe, expect, it } from 'vitest';

import {
  LEGACY_AID_STATION_KM_TOLERANCE,
  matchPersonalAidStation,
  normalizeAidStationNameForReflection,
  resolvePersonalAidStationTargetIndex,
} from './racebookPlanReflection';

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
