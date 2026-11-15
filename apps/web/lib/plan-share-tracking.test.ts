import { describe, expect, it } from 'vitest';

import {
  buildPlanShareTimeline,
  isPlanShareTrackableCheckpoint,
  normalizePlanSharePassages,
} from '@trailplanner/shared';

const checkpoints = [
  { index: 0, name: 'Start', arrivalMinute: 0, isStart: true, isFinish: false, assistanceState: 'available' as const },
  { index: 1, name: 'No crew', arrivalMinute: 60, isStart: false, isFinish: false, assistanceState: 'unavailable' as const },
  { index: 2, name: 'Crew', arrivalMinute: 120, isStart: false, isFinish: false, assistanceState: 'available' as const },
  { index: 3, name: 'Finish', arrivalMinute: 180, isStart: false, isFinish: true, assistanceState: 'unavailable' as const },
];

describe('plan-share tracking', () => {
  it('skips no-assistance checkpoints and recalculates later estimates from the last passage', () => {
    expect(isPlanShareTrackableCheckpoint(checkpoints[1])).toBe(false);
    const timeline = buildPlanShareTimeline(checkpoints, [
      { checkpointIndex: 2, actualMinute: 135, confirmedAt: '2026-11-15T10:15:00Z' },
    ], '08:00');
    expect(timeline.nextCheckpoint?.index).toBe(3);
    expect(timeline.nextAbsolute).toBe(8 * 60 + 195);
    expect(timeline.delta).toBe(15);
  });

  it('deduplicates, rounds and orders passage confirmations', () => {
    expect(normalizePlanSharePassages([
      { checkpointIndex: 3, actualMinute: 190.6, confirmedAt: 'b' },
      { checkpointIndex: 2, actualMinute: -2, confirmedAt: 'a' },
      { checkpointIndex: 99, actualMinute: 1, confirmedAt: 'x' },
    ], checkpoints)).toEqual([
      { checkpointIndex: 2, actualMinute: 0, confirmedAt: 'a' },
      { checkpointIndex: 3, actualMinute: 191, confirmedAt: 'b' },
    ]);
  });
});
