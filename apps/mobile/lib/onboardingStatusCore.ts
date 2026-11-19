/**
 * Guided tours: `racebook` (runner, Livret coureur), `supporter` (crew and
 * relatives, Livret supporter) and the optional `plan` tour offered after the
 * RaceBook tour.
 */
export type OnboardingKind = 'plan' | 'racebook' | 'supporter';
export type OnboardingStatus = 'pending' | 'in_progress' | 'skipped' | 'completed';

export type OnboardingStatuses = {
  plan: OnboardingStatus;
  racebook: OnboardingStatus;
  supporter: OnboardingStatus;
};

/** Tours that each present one Livret: finishing either one is the onboarding goal. */
export const LIVRET_ONBOARDING_KINDS = ['racebook', 'supporter'] as const;

export const DEFAULT_ONBOARDING_STATUSES: OnboardingStatuses = {
  plan: 'pending',
  racebook: 'pending',
  supporter: 'pending',
};

function isOnboardingStatus(value: unknown): value is OnboardingStatus {
  return value === 'pending' || value === 'in_progress' || value === 'skipped' || value === 'completed';
}

function parseStatus(value: unknown): OnboardingStatus {
  return isOnboardingStatus(value) ? value : 'pending';
}

export function parseOnboardingStatuses(row: unknown): OnboardingStatuses {
  const candidate = (row ?? {}) as {
    plan_onboarding_status?: unknown;
    racebook_onboarding_status?: unknown;
    supporter_onboarding_status?: unknown;
  };

  return {
    plan: parseStatus(candidate.plan_onboarding_status),
    racebook: parseStatus(candidate.racebook_onboarding_status),
    supporter: parseStatus(candidate.supporter_onboarding_status),
  };
}

/** No tour was ever started or skipped: open the welcome chooser. */
export function isOnboardingUntouched(statuses: OnboardingStatuses) {
  return statuses.plan === 'pending' && statuses.racebook === 'pending' && statuses.supporter === 'pending';
}

/**
 * Profile attention dot: shown until the runner or supporter finished the tour
 * of a Livret (either one). Skipped tours keep it; the optional plan tour and
 * the other audience's tour never do.
 */
export function hasPendingOnboarding(statuses: OnboardingStatuses) {
  return LIVRET_ONBOARDING_KINDS.every((kind) => statuses[kind] !== 'completed');
}
