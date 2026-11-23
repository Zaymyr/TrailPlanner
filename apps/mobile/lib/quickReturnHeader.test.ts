import { describe, expect, it } from 'vitest';

import {
  INITIAL_QUICK_RETURN_STATE,
  nextQuickReturnState,
  type QuickReturnState,
} from './quickReturnHeader';

const LIST = { contentHeight: 3000, viewportHeight: 800, threshold: 76, active: true };

function scrollThrough(offsets: number[], options: Partial<typeof LIST> = {}, from = INITIAL_QUICK_RETURN_STATE) {
  return offsets.reduce<QuickReturnState>(
    (state, offsetY) => nextQuickReturnState(state, { ...LIST, ...options, offsetY }),
    from,
  );
}

describe('nextQuickReturnState', () => {
  it('stays shown inside the threshold', () => {
    expect(scrollThrough([20, 50, 76]).hidden).toBe(false);
  });

  it('hides after enough downward travel past the threshold', () => {
    expect(scrollThrough([70, 90]).hidden).toBe(false);
    expect(scrollThrough([70, 90, 100]).hidden).toBe(true);
  });

  it('comes back on a short upward scroll', () => {
    const hidden = scrollThrough([100, 200, 400]);
    expect(hidden.hidden).toBe(true);
    expect(scrollThrough([397], {}, hidden).hidden).toBe(true);
    expect(scrollThrough([397, 393], {}, hidden).hidden).toBe(false);
  });

  it('always shows again back at the top', () => {
    const hidden = scrollThrough([100, 400]);
    expect(scrollThrough([-40], {}, hidden).hidden).toBe(false);
  });

  it('ignores the rubber band past the bottom', () => {
    const atBottom = scrollThrough([100, 2200]);
    expect(atBottom.hidden).toBe(true);
    // Overscroll then bounce back to the real end: no upward travel.
    expect(scrollThrough([2260, 2230, 2200], {}, atBottom).hidden).toBe(true);
  });

  it('never hides when inactive', () => {
    expect(scrollThrough([100, 400, 900], { active: false }).hidden).toBe(false);
  });

  it('never hides a list too short to scroll past the threshold', () => {
    expect(scrollThrough([100, 400], { contentHeight: 850 }).hidden).toBe(false);
  });
});
