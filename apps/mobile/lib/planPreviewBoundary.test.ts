import { describe, expect, it } from 'vitest';
import {
  getPreviewBoundaryTop,
  resolvePlanPreviewBoundary,
  shouldTriggerPreviewLimit,
} from './planPreviewBoundary';

const station = (id: string) => ({ id });

describe('plan preview boundary', () => {
  it('does not count departure or arrival as intermediate ravitos', () => {
    const result = resolvePlanPreviewBoundary(
      [station('depart'), station('r1'), station('r2'), station('r3'), station('arrivee')],
      'depart',
      'arrivee',
    );

    expect(result.visibleStationIndexes).toEqual([0, 1, 2]);
    expect(result.boundaryStationIndex).toBe(3);
    expect(result.hasHiddenCourse).toBe(true);
  });

  it('keeps the real arrival visible for a short course without creating an automatic gate', () => {
    const result = resolvePlanPreviewBoundary(
      [station('depart'), station('r1'), station('r2'), station('arrivee')],
      'depart',
      'arrivee',
    );

    expect(result.visibleStationIndexes).toEqual([0, 1, 2, 3]);
    expect(result.boundaryStationIndex).toBeNull();
    expect(result.hasHiddenCourse).toBe(false);
  });

  it('uses the third intermediate ravito as the single boundary regardless of remaining rows', () => {
    const result = resolvePlanPreviewBoundary(
      [station('depart'), station('r1'), station('r2'), station('r3'), station('r4'), station('r5'), station('arrivee')],
      'depart',
      'arrivee',
    );

    expect(result.visibleStationIndexes).toEqual([0, 1, 2]);
    expect(result.boundaryStationIndex).toBe(3);
  });
});

describe('shouldTriggerPreviewLimit', () => {
  const reachedBoundary = {
    boundaryTop: 600,
    scrollY: 220,
    viewportHeight: 400,
  };

  it('does not trigger on mount before a deliberate scroll', () => {
    expect(shouldTriggerPreviewLimit({
      ...reachedBoundary,
      hasDeliberateScroll: false,
      hasReported: false,
    })).toBe(false);
  });

  it('triggers once after a deliberate scroll reaches the boundary', () => {
    expect(shouldTriggerPreviewLimit({
      ...reachedBoundary,
      hasDeliberateScroll: true,
      hasReported: false,
    })).toBe(true);
    expect(shouldTriggerPreviewLimit({
      ...reachedBoundary,
      hasDeliberateScroll: true,
      hasReported: true,
    })).toBe(false);
  });

  it('does not trigger without a hidden-content boundary', () => {
    expect(shouldTriggerPreviewLimit({
      boundaryTop: null,
      hasDeliberateScroll: true,
      hasReported: false,
      scrollY: 999,
      viewportHeight: 400,
    })).toBe(false);
  });
});

describe('getPreviewBoundaryTop', () => {
  it('waits for the boundary after the toolbar instead of interrupting earlier cards', () => {
    const input = {
      boundaryTop: getPreviewBoundaryTop(156, 720),
      hasDeliberateScroll: true,
      hasReported: false,
      viewportHeight: 500,
    };
    expect(shouldTriggerPreviewLimit({ ...input, scrollY: 350 })).toBe(false);
    expect(shouldTriggerPreviewLimit({ ...input, scrollY: 400 })).toBe(true);
  });
});
