import { describe, expect, it } from 'vitest';

import {
  MAX_PROMPT_COUNT,
  PROMPT_COOLDOWN_DAYS,
  shouldRequestAppReview,
  type AppReviewEligibilityState,
} from './appReviewPolicy';

const eligibleState: AppReviewEligibilityState = {
  lastPromptAt: null,
  onboardingCompleted: true,
  pendingPrompt: true,
  planCreatedCount: 1,
  planSavedCount: 1,
  promptCount: 0,
  raceCreatedCount: 0,
  sessionCount: 5,
  totalActiveMs: 0,
};

describe('app review policy', () => {
  it('makes a returning account with a saved plan eligible from its second session', () => {
    expect(
      shouldRequestAppReview(
        { ...eligibleState, pendingPrompt: false, planCreatedCount: 0, planSavedCount: 0, sessionCount: 1 },
        { hasExistingPlan: true },
      ),
    ).toBe(false);

    expect(
      shouldRequestAppReview(
        { ...eligibleState, pendingPrompt: false, planCreatedCount: 0, planSavedCount: 0, sessionCount: 2 },
        { hasExistingPlan: true },
      ),
    ).toBe(true);
  });

  it('keeps the engagement threshold for users not known to have a saved plan', () => {
    expect(shouldRequestAppReview({ ...eligibleState, sessionCount: 4 })).toBe(false);
    expect(shouldRequestAppReview(eligibleState)).toBe(true);
  });

  it('applies the cooldown and maximum attempts to returning plan owners', () => {
    const now = new Date('2026-11-02T12:00:00Z').getTime();
    const recentPromptAt = new Date(now - (PROMPT_COOLDOWN_DAYS - 1) * 24 * 60 * 60 * 1000).toISOString();

    expect(
      shouldRequestAppReview(
        { ...eligibleState, lastPromptAt: recentPromptAt },
        { hasExistingPlan: true, now },
      ),
    ).toBe(false);
    expect(
      shouldRequestAppReview(
        { ...eligibleState, promptCount: MAX_PROMPT_COUNT },
        { hasExistingPlan: true, now },
      ),
    ).toBe(false);
  });
});
