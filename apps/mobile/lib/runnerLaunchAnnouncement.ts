export const RUNNER_LAUNCH_CAMPAIGN = '1.0-support';
export type RunnerLaunchInfo = {
  launchedAt: string | null;
  endsAt: string | null;
  eligible: boolean;
  earlySupporter: boolean;
};
export const EMPTY_RUNNER_LAUNCH: RunnerLaunchInfo = {
  launchedAt: null, endsAt: null, eligible: false, earlySupporter: false,
};
export type RunnerLaunchPreference = { seen: boolean };
export function getRunnerLaunchStorageKey(userId: string) {
  return `paceyourself.runner-launch.${RUNNER_LAUNCH_CAMPAIGN}:${userId}`;
}
export function parseRunnerLaunchPreference(value: string | null): RunnerLaunchPreference {
  if (value === null) return { seen: false };
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid launch preference');
  const preference = parsed as Partial<RunnerLaunchPreference> & { hidden?: unknown; lastSeenDay?: unknown };
  if (typeof preference.seen === 'boolean') return { seen: preference.seen };
  if (typeof preference.hidden === 'boolean' && (preference.lastSeenDay === null || typeof preference.lastSeenDay === 'string')) {
    return { seen: preference.hidden || preference.lastSeenDay !== null };
  }
  throw new Error('Invalid launch preference');
}
export function shouldShowRunnerLaunchAnnouncement(info: RunnerLaunchInfo, preference: RunnerLaunchPreference, now: Date) {
  const startsAt = Date.parse(info.launchedAt ?? '');
  const endsAt = Date.parse(info.endsAt ?? '');
  const timestamp = now.getTime();
  return info.eligible && info.earlySupporter
    && Number.isFinite(startsAt) && Number.isFinite(endsAt)
    && timestamp >= startsAt && timestamp < Math.min(endsAt, startsAt + 7 * 86_400_000)
    && !preference.seen;
}
