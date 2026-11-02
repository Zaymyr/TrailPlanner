export const MIN_SESSION_COUNT = 5;
export const MIN_RETURNING_PLAN_SESSION_COUNT = 2;
export const MIN_PLAN_SAVE_COUNT = 1;
export const PROMPT_COOLDOWN_DAYS = 60;
export const MAX_PROMPT_COUNT = 3;

export type AppReviewEligibilityState = {
  lastPromptAt: string | null;
  onboardingCompleted: boolean;
  pendingPrompt: boolean;
  planCreatedCount: number;
  planSavedCount: number;
  promptCount: number;
  raceCreatedCount: number;
  sessionCount: number;
  totalActiveMs: number;
};

export type AppReviewEligibilityContext = {
  hasExistingPlan?: boolean;
  now?: number;
};

function hasMeaningfulEngagement(state: AppReviewEligibilityState) {
  return (
    state.planCreatedCount >= 1 &&
    (state.planSavedCount >= MIN_PLAN_SAVE_COUNT || state.raceCreatedCount >= 1)
  );
}

function hasCompletedOnboardingEnough(state: AppReviewEligibilityState) {
  return (
    state.onboardingCompleted ||
    state.planCreatedCount > 0 ||
    state.planSavedCount > 0 ||
    state.raceCreatedCount > 0
  );
}

function isPromptCooldownElapsed(lastPromptAt: string | null, now: number) {
  if (!lastPromptAt) return true;
  const lastPromptTime = new Date(lastPromptAt).getTime();
  if (!Number.isFinite(lastPromptTime)) return true;
  return now - lastPromptTime >= PROMPT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

export function shouldRequestAppReview(
  state: AppReviewEligibilityState,
  context: AppReviewEligibilityContext = {},
) {
  if (state.promptCount >= MAX_PROMPT_COUNT) return false;
  if (!isPromptCooldownElapsed(state.lastPromptAt, context.now ?? Date.now())) return false;

  if (context.hasExistingPlan) {
    return state.sessionCount >= MIN_RETURNING_PLAN_SESSION_COUNT;
  }

  if (!state.pendingPrompt) return false;
  if (!hasCompletedOnboardingEnough(state)) return false;
  if (state.sessionCount < MIN_SESSION_COUNT) return false;
  return hasMeaningfulEngagement(state);
}
