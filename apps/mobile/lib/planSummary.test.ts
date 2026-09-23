import { describe, expect, it } from 'vitest';

import { DEFAULT_PLAN_VALUES } from '../components/plan-form/contracts';
import { buildPlanSectionSummary, getBaseSpeedKph } from '../components/plan-form/section-summary';
import {
  applyStoredDepartureTime,
  buildPlanSummary,
  buildStoredRacePlanFromValues,
  getPlanSummaryDepartureTimeStorageKey,
} from './planSummary';
import { normalizeStoredPlanValues } from './raceLivePlan';

describe('buildPlanSummary', () => {
  it('uses the same exact section durations as the plan highlights', () => {
    const plan = buildStoredRacePlanFromValues({
      id: 'plan-1',
      values: {
        ...DEFAULT_PLAN_VALUES,
        name: 'Trail test',
        raceDistanceKm: 10,
        paceMinutes: 7,
        paceSeconds: 7,
        aidStations: [
          {
            id: 'aid-1',
            name: 'Ravito',
            distanceKm: 4,
            waterRefill: true,
            pauseMinutes: 2,
          },
        ],
      },
    });
    const values = normalizeStoredPlanValues(plan);
    const baseSpeedKph = getBaseSpeedKph(values);
    const expectedDuration = values.aidStations.slice(0, -1).reduce((total, _, index) => {
      const section = buildPlanSectionSummary({
        values,
        elevationProfile: [],
        baseSpeedKph,
        target: index === 0 ? 'start' : index,
      });
      return total + (section?.durationMin ?? 0);
    }, 0);

    expect(expectedDuration % 5).not.toBeCloseTo(0);

    const summary = buildPlanSummary(plan, {});
    expect(summary.totalDurationMin).toBeCloseTo(expectedDuration);
    expect(summary.checkpoints.at(-1)?.arrivalMinute).toBeCloseTo(expectedDuration);
  });
});

describe('applyStoredDepartureTime', () => {
  it('uses a distinct persistence key for each plan', () => {
    expect(getPlanSummaryDepartureTimeStorageKey('plan-1')).not.toBe(
      getPlanSummaryDepartureTimeStorageKey('plan-2'),
    );
  });

  it('restores a manually selected time on the supplied day', () => {
    const restored = applyStoredDepartureTime('06:35', new Date(2026, 8, 23, 15, 12));

    expect(restored).not.toBeNull();
    expect(restored?.getHours()).toBe(6);
    expect(restored?.getMinutes()).toBe(35);
    expect(restored?.getSeconds()).toBe(0);
  });

  it('ignores malformed or out-of-range stored values', () => {
    expect(applyStoredDepartureTime('24:00')).toBeNull();
    expect(applyStoredDepartureTime('6:30')).toBeNull();
    expect(applyStoredDepartureTime(null)).toBeNull();
  });
});
