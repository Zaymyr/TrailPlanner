import { describe, expect, it } from 'vitest';

import {
  buildCheckpointHandover,
  buildFollowedSupporterTimeline,
  buildPlanShareTimeline,
  isPlanShareCheckpointPassed,
  normalizePlanSharePassages,
  resolvePlanSharePassageCorrection,
  type TrackingCheckpoint,
} from './followedPlanTimeline';

const checkpoints: TrackingCheckpoint[] = [
  { index: 0, name: 'Start', arrivalMinute: 0, distanceKm: 0, isStart: true, isFinish: false, assistanceState: 'start' },
  { index: 1, name: 'Crew', arrivalMinute: 60, distanceKm: 10, isStart: false, isFinish: false, assistanceState: 'available' },
  { index: 2, name: 'Finish', arrivalMinute: 120, distanceKm: 20, isStart: false, isFinish: true, assistanceState: 'finish' },
];

describe('followed plan timeline mobile boundary', () => {
  it('uses the latest confirmed checkpoint to recalibrate the next estimate', () => {
    const timeline = buildPlanShareTimeline(checkpoints, [{ checkpointIndex: 1, actualMinute: 75, confirmedAt: 'now' }], '08:00');
    expect(timeline.delta).toBe(15);
    expect(timeline.nextAbsolute).toBe(615);
    expect(buildFollowedSupporterTimeline([{ id: 'point', km: 15 }], checkpoints, [{ checkpointIndex: 1, actualMinute: 75, confirmedAt: 'now' }], '08:00')[0]).toMatchObject({ elapsedMinute: 105, absoluteMinute: 585 });
  });

  it('drops unknown passages and keeps the latest value per checkpoint', () => {
    expect(normalizePlanSharePassages([
      { checkpointIndex: 1, actualMinute: 62.4, confirmedAt: 'old' },
      { checkpointIndex: 9, actualMinute: 5, confirmedAt: 'unknown' },
      { checkpointIndex: 1, actualMinute: 64.6, confirmedAt: 'new' },
    ], checkpoints)).toEqual([{ checkpointIndex: 1, actualMinute: 65, confirmedAt: 'new' }]);
  });

  it('corrects a passage time, collapses passed points and lists the handover', () => {
    expect(resolvePlanSharePassageCorrection('09:20', '08:00', checkpoints[1]!)).toBe(80);
    expect(resolvePlanSharePassageCorrection('9h20', '08:00', checkpoints[1]!)).toBeNull();
    const timeline = buildPlanShareTimeline(checkpoints, [{ checkpointIndex: 1, actualMinute: 80, confirmedAt: 'now' }], '08:00');
    expect(checkpoints.map((checkpoint) => isPlanShareCheckpointPassed(checkpoint, timeline))).toEqual([true, true, false]);
    expect(buildCheckpointHandover({ ...checkpoints[1]!, waterState: 'refill', supplies: [{ productId: 'bar', name: 'Barre', quantity: 1 }, { productId: 'none', name: 'Rien', quantity: 0 }] }, 0))
      .toEqual([
        { key: '1:bar', kind: 'product', name: 'Barre', quantity: 1, liters: null },
        { key: '1:water', kind: 'water', name: 'water', quantity: null, liters: null },
      ]);
  });
});
