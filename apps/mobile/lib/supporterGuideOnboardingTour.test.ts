import { describe, expect, it } from 'vitest';

import { buildSupporterGuideTourSteps } from './supporterGuideOnboardingTour';

describe('buildSupporterGuideTourSteps', () => {
  it('walks the tab bar, every visible section in order, the emergency call, then wraps up', () => {
    const steps = buildSupporterGuideTourSteps({
      sections: ['programme', 'follow', 'onsite', 'stay', 'practical'],
      hasEmergency: true,
    });
    expect(steps.map((step) => step.key)).toEqual([
      'tabBar', 'programme', 'follow', 'onsite', 'stay', 'practical', 'emergency', 'wrapUp',
    ]);
    expect(steps[0]).toEqual({ key: 'tabBar', target: 'tabBar', section: 'programme', scroll: 'top' });
    expect(steps[2]).toEqual({ key: 'follow', target: 'tabContent', section: 'follow', scroll: 'content' });
    expect(steps.at(-1)).toEqual({ key: 'wrapUp', target: null, section: null, scroll: 'top' });
  });

  it('skips the sections and the emergency call this guide does not show', () => {
    expect(buildSupporterGuideTourSteps({ sections: ['programme', 'practical'], hasEmergency: false }).map((step) => step.key))
      .toEqual(['tabBar', 'programme', 'practical', 'wrapUp']);
  });

  it('still ends on the wrap-up when no section is visible', () => {
    expect(buildSupporterGuideTourSteps({ sections: [], hasEmergency: false }).map((step) => step.key)).toEqual(['wrapUp']);
  });
});
