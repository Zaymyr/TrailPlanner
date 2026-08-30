export type OnboardingKind = 'plan' | 'racebook';
export type OnboardingStatus = 'pending' | 'in_progress' | 'skipped' | 'completed';

export type OnboardingStatuses = {
  plan: OnboardingStatus;
  racebook: OnboardingStatus;
};

export const DEFAULT_ONBOARDING_STATUSES: OnboardingStatuses = {
  plan: 'pending',
  racebook: 'pending',
};

function isOnboardingStatus(value: unknown): value is OnboardingStatus {
  return value === 'pending' || value === 'in_progress' || value === 'skipped' || value === 'completed';
}

export function parseOnboardingStatuses(row: unknown): OnboardingStatuses {
  const candidate = (row ?? {}) as {
    plan_onboarding_status?: unknown;
    racebook_onboarding_status?: unknown;
  };

  return {
    plan: isOnboardingStatus(candidate.plan_onboarding_status)
      ? candidate.plan_onboarding_status
      : 'pending',
    racebook: isOnboardingStatus(candidate.racebook_onboarding_status)
      ? candidate.racebook_onboarding_status
      : 'pending',
  };
}

export function hasPendingOnboarding(statuses: OnboardingStatuses) {
  return statuses.plan !== 'completed' || statuses.racebook !== 'completed';
}
