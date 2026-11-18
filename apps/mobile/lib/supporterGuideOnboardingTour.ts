import type { SupporterGuideSection } from './supporterGuide';

/** Measured zones of the Livret supporter screen the tour can highlight. */
export type SupporterTourTargetKey = 'tabBar' | 'tabContent' | 'emergency';

export type SupporterTourStepKey = 'tabBar' | SupporterGuideSection | 'emergency' | 'wrapUp';

export type SupporterTourStepSpec = {
  key: SupporterTourStepKey;
  /** Null for the centered wrap-up step. */
  target: SupporterTourTargetKey | null;
  /** Section shown during the step; null keeps the current one. */
  section: SupporterGuideSection | null;
  /** `top`: hero expanded; `content`: hero compact, the section placed just below it. */
  scroll: 'top' | 'content';
};

/**
 * Guided Livret supporter tour built from what this guide actually shows:
 * the tab bar, each visible section in tab-bar order, the organizer emergency
 * call when published, then a centered wrap-up.
 */
export function buildSupporterGuideTourSteps({
  sections,
  hasEmergency,
}: {
  sections: SupporterGuideSection[];
  hasEmergency: boolean;
}): SupporterTourStepSpec[] {
  const steps: SupporterTourStepSpec[] = [];
  const firstSection = sections[0] ?? null;

  if (sections.length > 0) {
    steps.push({ key: 'tabBar', target: 'tabBar', section: firstSection, scroll: 'top' });
  }
  for (const section of sections) {
    steps.push({ key: section, target: 'tabContent', section, scroll: 'content' });
  }
  if (hasEmergency) {
    steps.push({ key: 'emergency', target: 'emergency', section: null, scroll: 'top' });
  }
  steps.push({ key: 'wrapUp', target: null, section: null, scroll: 'top' });
  return steps;
}
