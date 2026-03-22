export const TRIAL_DURATION_DAYS = 14;

export type TrialStatus = {
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialWelcomeSeenAt: string | null;
};

export const buildTrialDates = (start = new Date()) => {
  const startTime = start.getTime();
  const trialStart = Number.isFinite(startTime) ? start : new Date();
  const trialEnd = new Date(trialStart.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  return {
    startedAt: trialStart.toISOString(),
    endsAt: trialEnd.toISOString(),
  };
};

export const isTrialActive = (trialEndsAt: string | null | undefined, now = new Date()): boolean => {
  if (!trialEndsAt) return false;
  const end = new Date(trialEndsAt);
  return Number.isFinite(end.getTime()) && end.getTime() > now.getTime();
};
