/** Downward travel needed before the header leaves, so a small nudge does not hide it. */
export const QUICK_RETURN_HIDE_DISTANCE = 24;
/** Upward travel that brings the header back: nearly immediate, as soon as the reader goes back up. */
export const QUICK_RETURN_REVEAL_DISTANCE = 6;

export type QuickReturnState = {
  hidden: boolean;
  /** Last clamped scroll offset. */
  lastY: number;
  /** Distance travelled in the current direction (positive = down). */
  travel: number;
};

export type QuickReturnScroll = {
  offsetY: number;
  contentHeight: number;
  viewportHeight: number;
  /** Offset under which the header always stays shown. */
  threshold: number;
  active: boolean;
};

export const INITIAL_QUICK_RETURN_STATE: QuickReturnState = { hidden: false, lastY: 0, travel: 0 };

/**
 * Next quick-return state for one scroll event. The offset is clamped to the
 * scrollable range so the iOS rubber band (pull-to-refresh, bounce back from the
 * bottom) never reads as a direction change.
 */
export function nextQuickReturnState(state: QuickReturnState, scroll: QuickReturnScroll): QuickReturnState {
  const maxY = Math.max(0, scroll.contentHeight - scroll.viewportHeight);
  const y = Math.min(Math.max(scroll.offsetY, 0), maxY);
  const delta = y - state.lastY;
  if (!scroll.active || y <= scroll.threshold) return { hidden: false, lastY: y, travel: 0 };
  if (delta === 0) return { ...state, lastY: y };
  const travel = Math.sign(delta) === Math.sign(state.travel) ? state.travel + delta : delta;
  if (!state.hidden && travel >= QUICK_RETURN_HIDE_DISTANCE) return { hidden: true, lastY: y, travel: 0 };
  if (state.hidden && travel <= -QUICK_RETURN_REVEAL_DISTANCE) return { hidden: false, lastY: y, travel: 0 };
  return { hidden: state.hidden, lastY: y, travel };
}
