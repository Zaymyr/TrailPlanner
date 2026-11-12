import type { SpotlightRect } from './helpTutorial';

export type RacebookTourTabKey = 'gear' | 'bib' | 'course' | 'access' | 'services';
export type RacebookTourCourseTabKey = 'route' | 'start-waves' | 'aid-stations' | 'supporters' | 'relay' | 'awards';

/** Measured zones of the RaceBook screen the tour can highlight. */
export type RacebookTourTargetKey =
  | 'lastMinute'
  | 'tabBar'
  | 'tabContent'
  | 'courseTabs'
  | 'emergency'
  | 'links';

export type RacebookTourStepKey =
  | 'lastMinute'
  | 'tabBar'
  | 'gear'
  | 'bib'
  | 'course'
  | 'courseTabs'
  | 'access'
  | 'services'
  | 'emergency'
  | 'links'
  | 'wrapUp';

/**
 * - `top`: hero expanded (scroll offset 0), for header and tab-bar zones.
 * - `lastMinute` / `content`: hero compact, the anchored block placed just
 *   below it so the highlighted zone is real, visible content.
 */
export type RacebookTourScroll = 'top' | 'lastMinute' | 'content';

export type RacebookTourStepSpec = {
  key: RacebookTourStepKey;
  /** Null for the centered wrap-up step. */
  target: RacebookTourTargetKey | null;
  /** Tab shown during the step; null keeps the current tab. */
  tab: RacebookTourTabKey | null;
  courseTab: RacebookTourCourseTabKey | null;
  scroll: RacebookTourScroll;
};

export type RacebookTourInput = {
  hasLastMinuteMessage: boolean;
  /** Header action worth pointing at: emergency call first, else organizer links. */
  headerTarget: 'emergency' | 'links' | null;
  tabs: RacebookTourTabKey[];
  courseTabs: RacebookTourCourseTabKey[];
};

/**
 * Builds the guided RaceBook tour from what this RaceBook actually shows:
 * missing zones (no last-minute banner, no header action, single course view)
 * are skipped. Tabs follow the tab-bar order.
 */
export function buildRacebookTourSteps({
  hasLastMinuteMessage,
  headerTarget,
  tabs,
  courseTabs,
}: RacebookTourInput): RacebookTourStepSpec[] {
  const steps: RacebookTourStepSpec[] = [];
  const firstTab = tabs[0] ?? null;

  if (hasLastMinuteMessage) {
    steps.push({ key: 'lastMinute', target: 'lastMinute', tab: firstTab, courseTab: null, scroll: 'lastMinute' });
  }

  if (tabs.length > 0) {
    steps.push({ key: 'tabBar', target: 'tabBar', tab: firstTab, courseTab: null, scroll: 'top' });
  }

  for (const tab of tabs) {
    if (tab !== 'course') {
      steps.push({ key: tab, target: 'tabContent', tab, courseTab: null, scroll: 'content' });
      continue;
    }

    steps.push({ key: 'course', target: 'tabContent', tab, courseTab: 'route', scroll: 'content' });
    if (courseTabs.length > 1) {
      steps.push({
        key: 'courseTabs',
        target: 'courseTabs',
        tab,
        courseTab: courseTabs.includes('aid-stations') ? 'aid-stations' : courseTabs[1] ?? 'route',
        scroll: 'content',
      });
    }
  }

  if (headerTarget) {
    steps.push({ key: headerTarget, target: headerTarget, tab: null, courseTab: null, scroll: 'top' });
  }

  steps.push({ key: 'wrapUp', target: null, tab: null, courseTab: null, scroll: 'top' });
  return steps;
}

/**
 * Scroll offset that places an anchored block just below the compact hero.
 * The hero is always fully collapsed (offset >= collapseDistance) and the
 * offset never exceeds what the content can scroll.
 */
export function resolveRacebookTourScrollOffset({
  anchorY,
  collapseDistance,
  compactHeaderBottom,
  maxOffset,
}: {
  anchorY: number | null;
  collapseDistance: number;
  compactHeaderBottom: number;
  maxOffset: number;
}) {
  const desired = anchorY === null
    ? collapseDistance
    : Math.max(collapseDistance, anchorY - compactHeaderBottom - 12);
  return Math.max(0, Math.min(desired, Math.max(collapseDistance, maxOffset)));
}

/**
 * Keeps a measured zone inside the visible band (between the header and the
 * bottom navigation) and short enough to leave room for the tooltip card, so
 * the card never has to cover the highlighted content. Returns null when the
 * zone is not visible yet (the caller measures again).
 */
export function fitRacebookTourHighlight(
  rect: SpotlightRect | null,
  bounds: { top: number; bottom: number },
  minCardSpace: number,
): SpotlightRect | null {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;

  const top = Math.max(rect.y, bounds.top);
  const bottom = Math.min(rect.y + rect.height, bounds.bottom);
  if (bottom - top < 8) return null;

  const maxHeight = Math.max(48, bounds.bottom - bounds.top - minCardSpace);
  return {
    x: rect.x,
    y: top,
    width: rect.width,
    height: Math.min(bottom - top, maxHeight),
  };
}
