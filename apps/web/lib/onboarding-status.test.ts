import { describe, expect, it } from 'vitest';

import {
  hasPendingOnboarding,
  isOnboardingUntouched,
  parseOnboardingStatuses,
} from '../../mobile/lib/onboardingStatusCore';

describe('mobile onboarding statuses', () => {
  it('defaults missing and invalid database values to pending', () => {
    expect(parseOnboardingStatuses(null)).toEqual({ plan: 'pending', racebook: 'pending', supporter: 'pending' });
    expect(parseOnboardingStatuses({ plan_onboarding_status: 'unknown' })).toEqual({
      plan: 'pending',
      racebook: 'pending',
      supporter: 'pending',
    });
  });

  it('preserves the four supported states independently', () => {
    expect(parseOnboardingStatuses({
      plan_onboarding_status: 'completed',
      racebook_onboarding_status: 'skipped',
      supporter_onboarding_status: 'in_progress',
    })).toEqual({ plan: 'completed', racebook: 'skipped', supporter: 'in_progress' });
  });

  it('reads a profile without the supporter column as a pending supporter tour', () => {
    expect(parseOnboardingStatuses({
      plan_onboarding_status: 'completed',
      racebook_onboarding_status: 'completed',
    }).supporter).toBe('pending');
  });

  it('keeps the profile dot until the tour of one Livret is completed', () => {
    expect(hasPendingOnboarding({ plan: 'pending', racebook: 'completed', supporter: 'pending' })).toBe(false);
    expect(hasPendingOnboarding({ plan: 'pending', racebook: 'skipped', supporter: 'completed' })).toBe(false);
    expect(hasPendingOnboarding({ plan: 'completed', racebook: 'skipped', supporter: 'skipped' })).toBe(true);
    expect(hasPendingOnboarding({ plan: 'completed', racebook: 'in_progress', supporter: 'pending' })).toBe(true);
  });

  it('opens the welcome chooser only while no tour was started or skipped', () => {
    expect(isOnboardingUntouched({ plan: 'pending', racebook: 'pending', supporter: 'pending' })).toBe(true);
    expect(isOnboardingUntouched({ plan: 'pending', racebook: 'pending', supporter: 'in_progress' })).toBe(false);
    expect(isOnboardingUntouched({ plan: 'skipped', racebook: 'pending', supporter: 'pending' })).toBe(false);
  });
});
