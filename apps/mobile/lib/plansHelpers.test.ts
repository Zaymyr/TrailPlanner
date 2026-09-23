import { describe, expect, it } from 'vitest';

import { DEFAULT_PLAN_VALUES } from '../components/plan-form/contracts';
import { estimateDuration, getPlanCardTitle } from '../components/plans/plansHelpers';
import type { PlanRow } from '../components/plans/types';
import { buildPlanSummary, buildStoredRacePlanFromRow, formatDuration } from './planSummary';

describe('estimateDuration', () => {
  it('uses the canonical plan duration including terrain, fatigue, segments, and aid-station pauses', () => {
    const plan = {
      id: 'plan-duration',
      created_at: '2026-09-23T08:00:00.000Z',
      updated_at: '2026-09-23T08:00:00.000Z',
      name: 'Trail avec pause',
      race_id: null,
      planner_values: {
        ...DEFAULT_PLAN_VALUES,
        raceDistanceKm: 20,
        elevationGain: 900,
        fatigueLevel: 4,
        paceMinutes: 6,
        paceSeconds: 0,
        aidStations: [
          {
            id: 'aid-1',
            name: 'Ravito',
            distanceKm: 10,
            waterRefill: true,
            pauseMinutes: 12,
          },
        ],
      },
      elevation_profile: [
        { distanceKm: 0, elevationM: 200 },
        { distanceKm: 10, elevationM: 900 },
        { distanceKm: 20, elevationM: 400 },
      ],
    } as unknown as PlanRow;
    const canonicalSummary = buildPlanSummary(buildStoredRacePlanFromRow(plan), {});

    expect(estimateDuration(plan)).toBe(formatDuration(canonicalSummary.totalDurationMin));
    expect(canonicalSummary.totalDurationMin).toBeGreaterThan(132);
  });
});

describe('getPlanCardTitle', () => {
  it('removes the repeated event prefix from a default plan name', () => {
    const plan = {
      name: 'Trail des Crêtes – 42 km',
      races: { name: 'Trail des Crêtes – 42 km' },
    } as PlanRow;

    expect(getPlanCardTitle(plan, 'Trail des Crêtes', 'fr')).toBe('42 km');
  });

  it('removes the event name when it follows the format name', () => {
    const plan = {
      name: 'TST 82 – Ultra des Cimes',
      races: { name: 'TST 82 – Ultra des Cimes' },
    } as PlanRow;

    expect(getPlanCardTitle(plan, 'Ultra des Cimes', 'fr')).toBe('TST 82');
  });

  it('uses a neutral plan label instead of repeating an identical event name', () => {
    const plan = {
      name: 'Ultra des Cimes',
      races: { name: 'Ultra des Cimes' },
    } as PlanRow;

    expect(getPlanCardTitle(plan, 'Ultra des Cimes', 'fr')).toBe('Plan de course');
  });

  it('keeps a runner-defined plan name unchanged', () => {
    const plan = {
      name: 'Objectif moins de 6 heures',
      races: { name: 'Trail des Crêtes – 42 km' },
    } as PlanRow;

    expect(getPlanCardTitle(plan, 'Trail des Crêtes', 'fr')).toBe('Objectif moins de 6 heures');
  });
});
