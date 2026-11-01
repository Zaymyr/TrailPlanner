import { describe, expect, it } from 'vitest';

import { compactPlanTimeline } from './planTimelinePresentation';

describe('compactPlanTimeline', () => {
  it('keeps product intakes and only water rhythm changes', () => {
    expect(compactPlanTimeline([
      { label: 'Eau', detail: '83 ml', waterMl: 83 },
      { label: 'Eau', detail: '84 ml', waterMl: 84 },
      { label: 'Gel', detail: '25g glucides', waterMl: 0, products: [{ name: 'Gel' }] },
      { label: 'Eau', detail: '96 ml', waterMl: 96 },
    ])).toEqual([
      { label: 'Eau', detail: '80 ml', waterMl: 80 },
      { label: 'Gel', detail: '25g glucides', waterMl: 0, products: [{ name: 'Gel' }] },
      { label: 'Eau', detail: '100 ml', waterMl: 100 },
    ]);
  });
});
