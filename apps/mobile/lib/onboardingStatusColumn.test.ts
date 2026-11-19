import { describe, expect, it, vi } from 'vitest';

import { isMissingSupporterStatusColumn } from './onboardingStatus';

// Hoisted above the import: the status module only needs these at call time.
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));
vi.mock('./supabase', () => ({ supabase: {} }));
vi.mock('./appSession', () => ({ ensureAppSession: vi.fn() }));
vi.mock('./posthog', () => ({ captureAnalyticsEvent: vi.fn() }));

describe('isMissingSupporterStatusColumn', () => {
  it('recognizes the select and the upsert errors of a schema without the supporter column', () => {
    expect(isMissingSupporterStatusColumn({
      code: '42703',
      message: 'column user_profiles.supporter_onboarding_status does not exist',
    })).toBe(true);
    expect(isMissingSupporterStatusColumn({
      code: 'PGRST204',
      message: "Could not find the 'supporter_onboarding_status' column of 'user_profiles' in the schema cache",
    })).toBe(true);
  });

  it('leaves every other error to the caller', () => {
    expect(isMissingSupporterStatusColumn(null)).toBe(false);
    expect(isMissingSupporterStatusColumn({ code: '42703', message: 'column user_profiles.other does not exist' })).toBe(false);
    expect(isMissingSupporterStatusColumn({ code: '42501', message: 'permission denied for supporter_onboarding_status' })).toBe(false);
  });
});
