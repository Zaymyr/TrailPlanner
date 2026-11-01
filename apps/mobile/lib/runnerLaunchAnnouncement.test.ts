import { describe, expect, it } from 'vitest';
import { getRunnerLaunchDay, getRunnerLaunchStorageKey, parseRunnerLaunchPreference, shouldShowRunnerLaunchAnnouncement, type RunnerLaunchInfo } from './runnerLaunchAnnouncement';

const info: RunnerLaunchInfo = {
  launchedAt: '2026-11-01T12:00:00Z', endsAt: '2026-11-08T12:00:00Z', eligible: true, earlySupporter: true,
};
const fresh = { hidden: false, lastSeenDay: null };

describe('launch campaign', () => {
  it('does not show before activation, before launch or at/after the seventh day', () => {
    expect(shouldShowRunnerLaunchAnnouncement({ ...info, launchedAt: null }, fresh, new Date('2026-11-02'))).toBe(false);
    expect(shouldShowRunnerLaunchAnnouncement(info, fresh, new Date('2026-11-01T11:59:59Z'))).toBe(false);
    expect(shouldShowRunnerLaunchAnnouncement(info, fresh, new Date('2026-11-08T12:00:00Z'))).toBe(false);
    expect(shouldShowRunnerLaunchAnnouncement({ ...info, endsAt: '2027-01-01' }, fresh, new Date('2026-11-09'))).toBe(false);
  });
  it('requires the prelaunch cohort and server eligibility', () => {
    expect(shouldShowRunnerLaunchAnnouncement({ ...info, eligible: false }, fresh, new Date('2026-11-02'))).toBe(false);
    expect(shouldShowRunnerLaunchAnnouncement({ ...info, earlySupporter: false }, fresh, new Date('2026-11-02'))).toBe(false);
    expect(shouldShowRunnerLaunchAnnouncement(info, fresh, new Date('2026-11-02'))).toBe(true);
  });
  it('shows again the next calendar day unless permanently hidden', () => {
    const today = new Date('2026-11-02T15:00:00Z');
    const preference = { hidden: false, lastSeenDay: getRunnerLaunchDay(today) };
    expect(shouldShowRunnerLaunchAnnouncement(info, preference, today)).toBe(false);
    expect(shouldShowRunnerLaunchAnnouncement(info, preference, new Date('2026-11-03T15:00:00Z'))).toBe(true);
    expect(shouldShowRunnerLaunchAnnouncement(info, { ...preference, hidden: true }, new Date('2026-11-03T15:00:00Z'))).toBe(false);
  });
  it('isolates accounts and ignores the previous announcement campaign', () => {
    expect(getRunnerLaunchStorageKey('a')).not.toBe(getRunnerLaunchStorageKey('b'));
    expect(getRunnerLaunchStorageKey('a')).toContain('1.0-support');
  });
  it('round trips preferences and rejects corrupt storage', () => {
    expect(parseRunnerLaunchPreference(null)).toEqual(fresh);
    expect(parseRunnerLaunchPreference(JSON.stringify({ hidden: true, lastSeenDay: '2026-11-2' }))).toEqual({ hidden: true, lastSeenDay: '2026-11-2' });
    for (const value of ['dismissed', 'null', '{}', '{"hidden":"yes","lastSeenDay":null}']) {
      expect(() => parseRunnerLaunchPreference(value)).toThrow();
    }
  });
});
