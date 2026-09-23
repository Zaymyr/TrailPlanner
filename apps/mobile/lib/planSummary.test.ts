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

  it('adds every intermediate aid-station pause to recap and finish times', () => {
    const buildPlan = (pauseMinutes: number[]) =>
      buildStoredRacePlanFromValues({
        id: 'plan-with-pauses',
        values: {
          ...DEFAULT_PLAN_VALUES,
          name: 'Trail avec pauses',
          raceDistanceKm: 30,
          elevationGain: 0,
          paceMinutes: 6,
          paceSeconds: 0,
          aidStations: [
            {
              id: 'aid-1',
              name: 'Ravito 1',
              distanceKm: 10,
              waterRefill: true,
              pauseMinutes: pauseMinutes[0],
            },
            {
              id: 'aid-2',
              name: 'Ravito 2',
              distanceKm: 20,
              waterRefill: true,
              pauseMinutes: pauseMinutes[1],
            },
          ],
        },
      });

    const withoutPauses = buildPlanSummary(buildPlan([0, 0]), {});
    const withPauses = buildPlanSummary(buildPlan([7, 11]), {});

    expect(withPauses.movingDurationMin).toBeCloseTo(withoutPauses.movingDurationMin);
    expect(withPauses.totalPauseMinutes).toBe(18);
    expect(withPauses.totalDurationMin - withoutPauses.totalDurationMin).toBeCloseTo(18);
    expect(withPauses.checkpoints[1]?.arrivalMinute).toBeCloseTo(
      withoutPauses.checkpoints[1]?.arrivalMinute ?? 0,
    );
    expect(
      (withPauses.checkpoints[2]?.arrivalMinute ?? 0) -
        (withoutPauses.checkpoints[2]?.arrivalMinute ?? 0),
    ).toBeCloseTo(7);
    expect(
      (withPauses.checkpoints.at(-1)?.arrivalMinute ?? 0) -
        (withoutPauses.checkpoints.at(-1)?.arrivalMinute ?? 0),
    ).toBeCloseTo(18);
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
