import { describe, expect, it } from 'vitest';

import {
  getPreviewBoundaryTop,
  resolvePlanPreviewBoundary,
  shouldStickPreviewUnlock,
} from './planPreviewBoundary';

const station = (id: string) => ({ id });

describe('plan preview boundary', () => {
  it('keeps only departure as the clear station and its outgoing section as the clear section', () => {
    const result = resolvePlanPreviewBoundary(
      [station('depart'), station('r1'), station('r2'), station('arrivee')],
      'depart',
    );

    expect(result.departureIndex).toBe(0);
    expect(result.firstSectionStartIndex).toBe(0);
    expect(result.ghostStationIndexes).toEqual([1, 2, 3]);
    expect(result.hasGhostContent).toBe(true);
  });

  it('does not invent a clear section when departure has no next station', () => {
    const result = resolvePlanPreviewBoundary([station('depart')], 'depart');

    expect(result.departureIndex).toBe(0);
    expect(result.firstSectionStartIndex).toBeNull();
    expect(result.ghostStationIndexes).toEqual([]);
    expect(result.hasGhostContent).toBe(false);
  });

  it('does not expose the first real ravito when the synthetic departure is missing', () => {
    const result = resolvePlanPreviewBoundary([station('r1'), station('arrivee')], 'depart');

    expect(result.departureIndex).toBe(-1);
    expect(result.firstSectionStartIndex).toBeNull();
    expect(result.ghostStationIndexes).toEqual([0, 1]);
  });
});

describe('sticky preview unlock', () => {
  it('becomes sticky only after the in-flow CTA reaches its sticky position', () => {
    const boundaryTop = getPreviewBoundaryTop(156, 420);

    expect(shouldStickPreviewUnlock(300, boundaryTop, 220)).toBe(false);
    expect(shouldStickPreviewUnlock(356, boundaryTop, 220)).toBe(true);
    expect(shouldStickPreviewUnlock(500, null, 220)).toBe(false);
  });
});
