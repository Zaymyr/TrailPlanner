import { describe, expect, it } from 'vitest';

import {
  calculateElevationLoss,
  findPlanViewAnchorAtFocus,
  formatAveragePace,
  getPlanViewScrollTarget,
  normalizePlanWorkspaceTab,
} from './planWorkspace';

describe('plan workspace helpers', () => {
  it('calculates cumulative descent without persisting another plan field', () => {
    expect(calculateElevationLoss([
      { distanceKm: 0, elevationM: 100 },
      { distanceKm: 2, elevationM: 180 },
      { distanceKm: 4, elevationM: 130 },
      { distanceKm: 6, elevationM: 160 },
      { distanceKm: 8, elevationM: 90 },
    ])).toBe(120);
  });

  it('returns null when descent cannot be derived', () => {
    expect(calculateElevationLoss([])).toBeNull();
    expect(calculateElevationLoss([{ distanceKm: 0, elevationM: 100 }])).toBeNull();
  });

  it('formats the exact total duration as an average pace', () => {
    expect(formatAveragePace(125, 20)).toBe('6:15');
    expect(formatAveragePace(0, 20)).toBe('—');
  });

  it('normalizes unknown routes to Mon plan', () => {
    expect(normalizePlanWorkspaceTab('recap')).toBe('recap');
    expect(normalizePlanWorkspaceTab('settings')).toBe('settings');
    expect(normalizePlanWorkspaceTab('unknown')).toBe('plan');
  });

  it('keeps the station intersecting the sticky focus line when switching views', () => {
    const anchors = [
      { index: 0, top: 0, bottom: 180 },
      { index: 1, top: 190, bottom: 430 },
      { index: 2, top: 440, bottom: 700 },
    ];

    expect(findPlanViewAnchorAtFocus(anchors, 315)?.index).toBe(1);
    expect(findPlanViewAnchorAtFocus(anchors, 900)?.index).toBe(2);
    expect(findPlanViewAnchorAtFocus(anchors, -10)?.index).toBe(0);
  });

  it('positions the matching anchor below the compact header and sticky controls', () => {
    expect(getPlanViewScrollTarget(280, 156, 440, 240)).toBe(636);
    expect(getPlanViewScrollTarget(20, 30, 40, 240)).toBe(0);
  });
});
