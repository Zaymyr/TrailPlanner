import { describe, expect, it } from 'vitest';

import {
  buildRacebookTourSteps,
  fitRacebookTourHighlight,
  resolveRacebookTourScrollOffset,
} from './racebookOnboardingTour';

const ALL_TABS = ['gear', 'bib', 'course', 'access', 'services'] as const;

describe('buildRacebookTourSteps', () => {
  it('walks every zone of a complete RaceBook in tab-bar order', () => {
    const steps = buildRacebookTourSteps({
      hasLastMinuteMessage: true,
      headerTarget: 'emergency',
      tabs: [...ALL_TABS],
      courseTabs: ['route', 'aid-stations', 'supporters'],
    });

    expect(steps.map((step) => step.key)).toEqual([
      'lastMinute', 'tabBar', 'gear', 'bib', 'course', 'courseTabs', 'access', 'services', 'emergency', 'wrapUp',
    ]);
    expect(steps.find((step) => step.key === 'courseTabs')).toMatchObject({ tab: 'course', courseTab: 'aid-stations' });
    expect(steps.find((step) => step.key === 'course')).toMatchObject({ courseTab: 'route', target: 'tabContent' });
    expect(steps.at(-1)).toMatchObject({ target: null });
  });

  it('skips the zones this RaceBook does not show', () => {
    const steps = buildRacebookTourSteps({
      hasLastMinuteMessage: false,
      headerTarget: null,
      tabs: [...ALL_TABS],
      courseTabs: ['route'],
    });

    expect(steps.map((step) => step.key)).toEqual(['tabBar', 'gear', 'bib', 'course', 'access', 'services', 'wrapUp']);
  });

  it('points at organizer links when there is no emergency number', () => {
    const steps = buildRacebookTourSteps({
      hasLastMinuteMessage: false,
      headerTarget: 'links',
      tabs: ['gear'],
      courseTabs: [],
    });

    expect(steps.map((step) => step.key)).toEqual(['tabBar', 'gear', 'links', 'wrapUp']);
  });

  it('uses the second course view when aid stations are not published', () => {
    const steps = buildRacebookTourSteps({
      hasLastMinuteMessage: false,
      headerTarget: null,
      tabs: ['course'],
      courseTabs: ['route', 'supporters'],
    });

    expect(steps.find((step) => step.key === 'courseTabs')?.courseTab).toBe('supporters');
  });
});

describe('resolveRacebookTourScrollOffset', () => {
  it('collapses the hero at least fully', () => {
    expect(resolveRacebookTourScrollOffset({ anchorY: 300, collapseDistance: 200, compactHeaderBottom: 110, maxOffset: 900 })).toBe(200);
  });

  it('places a lower anchor just below the compact header', () => {
    expect(resolveRacebookTourScrollOffset({ anchorY: 600, collapseDistance: 200, compactHeaderBottom: 110, maxOffset: 900 })).toBe(478);
  });

  it('never scrolls past the content end', () => {
    expect(resolveRacebookTourScrollOffset({ anchorY: 900, collapseDistance: 200, compactHeaderBottom: 110, maxOffset: 350 })).toBe(350);
  });

  it('falls back to the collapse distance without an anchor', () => {
    expect(resolveRacebookTourScrollOffset({ anchorY: null, collapseDistance: 200, compactHeaderBottom: 110, maxOffset: 0 })).toBe(200);
  });
});

describe('fitRacebookTourHighlight', () => {
  const bounds = { top: 100, bottom: 700 };

  it('returns null for missing or hidden zones', () => {
    expect(fitRacebookTourHighlight(null, bounds, 260)).toBeNull();
    expect(fitRacebookTourHighlight({ x: 0, y: 720, width: 300, height: 80 }, bounds, 260)).toBeNull();
  });

  it('clips the zone to the visible band', () => {
    expect(fitRacebookTourHighlight({ x: 16, y: 60, width: 300, height: 100 }, bounds, 260))
      .toEqual({ x: 16, y: 100, width: 300, height: 60 });
  });

  it('leaves room for the tooltip card under a tall zone', () => {
    expect(fitRacebookTourHighlight({ x: 16, y: 120, width: 300, height: 2000 }, bounds, 260))
      .toEqual({ x: 16, y: 120, width: 300, height: 340 });
  });
});
