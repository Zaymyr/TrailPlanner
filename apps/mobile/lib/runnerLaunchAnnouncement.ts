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
export type RunnerLaunchPreference = { hidden: boolean; lastSeenDay: string | null };
export function getRunnerLaunchStorageKey(userId: string) {
  return `paceyourself.runner-launch.${RUNNER_LAUNCH_CAMPAIGN}:${userId}`;
}
// Calendar day on this device, not 24 hours since the previous visit.
export function getRunnerLaunchDay(now: Date) {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}
export function parseRunnerLaunchPreference(value: string | null): RunnerLaunchPreference {
  if (value === null) return { hidden: false, lastSeenDay: null };
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid launch preference');
  const preference = parsed as Partial<RunnerLaunchPreference>;
  if (typeof preference.hidden !== 'boolean' || (preference.lastSeenDay !== null && typeof preference.lastSeenDay !== 'string')) {
    throw new Error('Invalid launch preference');
  }
  return preference as RunnerLaunchPreference;
}
export function shouldShowRunnerLaunchAnnouncement(info: RunnerLaunchInfo, preference: RunnerLaunchPreference, now: Date) {
  const startsAt = Date.parse(info.launchedAt ?? '');
  const endsAt = Date.parse(info.endsAt ?? '');
  const timestamp = now.getTime();
  return info.eligible && info.earlySupporter
    && Number.isFinite(startsAt) && Number.isFinite(endsAt)
    && timestamp >= startsAt && timestamp < Math.min(endsAt, startsAt + 7 * 86_400_000)
    && !preference.hidden && preference.lastSeenDay !== getRunnerLaunchDay(now);
}
