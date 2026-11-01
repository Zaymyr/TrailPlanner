import { describe, expect, it } from 'vitest';

import {
  getPreviewBoundaryTop,
  getPreviewReachableContentMinHeight,
  resolvePlanPreviewBoundary,
  resolveCenteredPreviewUnlockGeometry,
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

describe('centered preview unlock', () => {
  const floating = resolveCenteredPreviewUnlockGeometry(720, 186, 64);
  const geometry = {
    boundaryHeight: 132,
    boundaryTopInSection: getPreviewBoundaryTop(156, 420),
    sectionTop: 340,
    targetCenterY: floating.centerY,
    toolbarIsSticky: true,
  };

  it('stays inline at the beginning, follows the viewport center, then returns inline when scrolling back', () => {
    expect(resolvePreviewUnlockPlacement({ ...geometry, scrollY: 0 })).toBe('inline');
    expect(resolvePreviewUnlockPlacement({ ...geometry, scrollY: 700 })).toBe('sticky');
    expect(resolvePreviewUnlockPlacement({ ...geometry, scrollY: 500 })).toBe('inline');
  });

  it('never detaches the CTA before the tabs themselves are sticky', () => {
    expect(resolvePreviewUnlockPlacement({
      ...geometry,
      scrollY: 900,
      toolbarIsSticky: false,
    })).toBe('inline');
  });

  it('centers the compact card in the useful viewport instead of beneath the tabs', () => {
    expect(floating.top).toBeGreaterThan(floating.usefulTop);
    expect(floating.centerY).toBeCloseTo((floating.usefulTop + floating.usefulBottom) / 2);
  });

  it('clamps the compact card inside a small viewport', () => {
    const small = resolveCenteredPreviewUnlockGeometry(180, 120, 88);

    expect(small.top).toBeGreaterThanOrEqual(0);
    expect(small.top + 88).toBeLessThanOrEqual(180);
    expect(small.centerY).toBeGreaterThan(120);
  });

  it('adds enough trailing room for a short course to reach the sticky threshold', () => {
    const viewportHeight = 720;
    const targetCenterY = floating.centerY;
    const boundaryContentTop = 640;
    const boundaryHeight = 132;
    const naturalShortContentHeight = 760;
    const minHeight = getPreviewReachableContentMinHeight(
      boundaryContentTop,
      boundaryHeight,
      viewportHeight,
      targetCenterY,
    );

    expect(minHeight).toBeGreaterThan(naturalShortContentHeight);
    const reachableMaxScroll = (minHeight ?? 0) - viewportHeight;
    expect(reachableMaxScroll).toBeGreaterThan(boundaryContentTop + boundaryHeight / 2 - targetCenterY);
  });
});
