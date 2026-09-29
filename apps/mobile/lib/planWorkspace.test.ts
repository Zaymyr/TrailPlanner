import { describe, expect, it } from 'vitest';

import { calculateElevationLoss, formatAveragePace, normalizePlanWorkspaceTab } from './planWorkspace';

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
});
