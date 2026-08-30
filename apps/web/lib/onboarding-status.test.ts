import { describe, expect, it } from 'vitest';

import {
  hasPendingOnboarding,
  parseOnboardingStatuses,
} from '../../mobile/lib/onboardingStatusCore';

describe('mobile onboarding statuses', () => {
  it('defaults missing and invalid database values to pending', () => {
    expect(parseOnboardingStatuses(null)).toEqual({ plan: 'pending', racebook: 'pending' });
    expect(parseOnboardingStatuses({ plan_onboarding_status: 'unknown' })).toEqual({
      plan: 'pending',
      racebook: 'pending',
    });
  });

  it('preserves the four supported states independently', () => {
    expect(parseOnboardingStatuses({
      plan_onboarding_status: 'completed',
      racebook_onboarding_status: 'skipped',
    })).toEqual({ plan: 'completed', racebook: 'skipped' });
  });

  it('hides the profile dot only when both tours are completed', () => {
    expect(hasPendingOnboarding({ plan: 'completed', racebook: 'completed' })).toBe(false);
    expect(hasPendingOnboarding({ plan: 'completed', racebook: 'skipped' })).toBe(true);
    expect(hasPendingOnboarding({ plan: 'in_progress', racebook: 'completed' })).toBe(true);
  });
});
