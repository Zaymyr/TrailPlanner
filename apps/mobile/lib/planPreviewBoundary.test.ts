import { describe, expect, it } from 'vitest';

import {
  getPreviewBoundaryTop,
  getPreviewReachableContentMinHeight,
  resolvePlanPreviewBoundary,
  resolvePreviewUnlockPlacement,
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
  const geometry = {
    boundaryTopInSection: getPreviewBoundaryTop(156, 420),
    sectionTop: 340,
    stickyHeaderTop: 132,
    stickyToolbarHeight: 54,
    toolbarIsSticky: true,
  };

  it('stays inline at the beginning, sticks below the measured toolbar, then returns inline when scrolling back', () => {
    expect(resolvePreviewUnlockPlacement({ ...geometry, scrollY: 0 })).toBe('inline');
    expect(resolvePreviewUnlockPlacement({ ...geometry, scrollY: 730 })).toBe('sticky');
    expect(resolvePreviewUnlockPlacement({ ...geometry, scrollY: 500 })).toBe('inline');
  });

  it('never detaches the CTA before the tabs themselves are sticky', () => {
    expect(resolvePreviewUnlockPlacement({
      ...geometry,
      scrollY: 900,
      toolbarIsSticky: false,
    })).toBe('inline');
  });

  it('adds enough trailing room for a short course to reach the sticky threshold', () => {
    const viewportHeight = 720;
    const pinnedTabsBottom = 186;
    const boundaryContentTop = 640;
    const naturalShortContentHeight = 760;
    const minHeight = getPreviewReachableContentMinHeight(
      boundaryContentTop,
      viewportHeight,
      pinnedTabsBottom,
    );

    expect(minHeight).toBeGreaterThan(naturalShortContentHeight);
    const reachableMaxScroll = (minHeight ?? 0) - viewportHeight;
    expect(reachableMaxScroll).toBeGreaterThan(boundaryContentTop - pinnedTabsBottom);
  });
});
