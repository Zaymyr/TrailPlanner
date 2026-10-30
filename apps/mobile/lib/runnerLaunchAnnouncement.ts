export const RUNNER_LAUNCH_CAMPAIGN = '1.0';
const RUNNER_LAUNCH_STORAGE_PREFIX = `paceyourself.runner-launch.${RUNNER_LAUNCH_CAMPAIGN}`;
const RUNNER_LAUNCH_ACK_VALUE = 'dismissed';

export type RunnerLaunchAccessStatus =
  | { kind: 'free' }
  | { kind: 'paid' }
  | { kind: 'trial'; endsAt: string }
  | { kind: 'grant'; endsAt: string };

export type RunnerLaunchAccessState = {
  hasPaidPremium: boolean;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  premiumGrant: { endsAt: string | null } | null;
};

type RunnerLaunchStorageReader = {
  getItem: (key: string) => Promise<string | null>;
};

type RunnerLaunchStorageWriter = {
  setItem: (key: string, value: string) => Promise<unknown>;
};

type RunnerLaunchVisibilityInput = {
  eligible: boolean;
  fetchEnabled: () => Promise<boolean>;
  storage: RunnerLaunchStorageReader;
  userId: string | null;
};

function parseFutureIso(value: string | null | undefined, nowMs: number): string | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > nowMs ? value : null;
}

export function resolveRunnerLaunchAccessStatus(
  state: RunnerLaunchAccessState,
  now: Date | number,
): RunnerLaunchAccessStatus {
  if (state.hasPaidPremium) return { kind: 'paid' };

  const nowMs = typeof now === 'number' ? now : now.getTime();
  const trialEndsAt = state.isTrialActive ? parseFutureIso(state.trialEndsAt, nowMs) : null;
  const grantEndsAt = parseFutureIso(state.premiumGrant?.endsAt, nowMs);

  if (trialEndsAt && grantEndsAt) {
    return new Date(grantEndsAt).getTime() > new Date(trialEndsAt).getTime()
      ? { kind: 'grant', endsAt: grantEndsAt }
      : { kind: 'trial', endsAt: trialEndsAt };
  }
  if (trialEndsAt) return { kind: 'trial', endsAt: trialEndsAt };
  if (grantEndsAt) return { kind: 'grant', endsAt: grantEndsAt };

  return { kind: 'free' };
}

export function getRunnerLaunchStorageKey(userId: string): string {
  return `${RUNNER_LAUNCH_STORAGE_PREFIX}:${userId}`;
}

export async function shouldShowRunnerLaunchAnnouncement({
  eligible,
  fetchEnabled,
  storage,
  userId,
}: RunnerLaunchVisibilityInput): Promise<boolean> {
  if (!eligible || !userId) return false;

  try {
    const acknowledgement = await storage.getItem(getRunnerLaunchStorageKey(userId));
    if (acknowledgement !== null) return false;
  } catch {
    return false;
  }

  try {
    return (await fetchEnabled()) === true;
  } catch {
    return false;
  }
}

export async function acknowledgeRunnerLaunchAnnouncement(
  userId: string,
  storage: RunnerLaunchStorageWriter,
): Promise<boolean> {
  try {
    await storage.setItem(getRunnerLaunchStorageKey(userId), RUNNER_LAUNCH_ACK_VALUE);
    return true;
  } catch {
    return false;
  }
}
