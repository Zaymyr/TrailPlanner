import { describe, expect, it, vi } from 'vitest';

import {
  acknowledgeRunnerLaunchAnnouncement,
  getRunnerLaunchStorageKey,
  resolveRunnerLaunchAccessStatus,
  shouldShowRunnerLaunchAnnouncement,
} from './runnerLaunchAnnouncement';

describe('runner launch announcement visibility', () => {
  it('does not consume the campaign marker while the canonical launch flag is off', async () => {
    const getItem = vi.fn(async () => null);
    const setItem = vi.fn(async () => undefined);
    const fetchEnabled = vi.fn(async () => false);
    const storage = { getItem, setItem };

    await expect(shouldShowRunnerLaunchAnnouncement({
      eligible: true,
      userId: 'user-a',
      storage,
      fetchEnabled,
    })).resolves.toBe(false);
    expect(fetchEnabled).toHaveBeenCalledOnce();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does no storage or network work before the root marks the screen eligible', async () => {
    const getItem = vi.fn(async () => null);
    const fetchEnabled = vi.fn(async () => true);
    await expect(shouldShowRunnerLaunchAnnouncement({
      eligible: false,
      userId: 'user-a',
      storage: { getItem },
      fetchEnabled,
    })).resolves.toBe(false);
    expect(getItem).not.toHaveBeenCalled();
    expect(fetchEnabled).not.toHaveBeenCalled();
  });

  it('scopes one campaign marker to each user on the device', async () => {
    const markers = new Map([[getRunnerLaunchStorageKey('user-a'), 'dismissed']]);
    const storage = { getItem: async (key: string) => markers.get(key) ?? null };
    const fetchEnabled = vi.fn(async () => true);

    await expect(shouldShowRunnerLaunchAnnouncement({
      eligible: true,
      userId: 'user-a',
      storage,
      fetchEnabled,
    })).resolves.toBe(false);
    await expect(shouldShowRunnerLaunchAnnouncement({
      eligible: true,
      userId: 'user-b',
      storage,
      fetchEnabled,
    })).resolves.toBe(true);
    expect(getRunnerLaunchStorageKey('user-b')).toBe('paceyourself.runner-launch.1.0:user-b');
    expect(fetchEnabled).toHaveBeenCalledOnce();
  });

  it('fails closed without marking seen on storage or network errors', async () => {
    const fetchAfterStorageFailure = vi.fn(async () => true);
    await expect(shouldShowRunnerLaunchAnnouncement({
      eligible: true,
      userId: 'user-a',
      storage: { getItem: async () => { throw new Error('storage unavailable'); } },
      fetchEnabled: fetchAfterStorageFailure,
    })).resolves.toBe(false);
    expect(fetchAfterStorageFailure).not.toHaveBeenCalled();

    await expect(shouldShowRunnerLaunchAnnouncement({
      eligible: true,
      userId: 'user-a',
      storage: { getItem: async () => null },
      fetchEnabled: async () => { throw new Error('network unavailable'); },
    })).resolves.toBe(false);
  });

  it('acknowledges only an explicit dismissal and reports persistence failure', async () => {
    const setItem = vi.fn(async () => undefined);
    await expect(acknowledgeRunnerLaunchAnnouncement('user-a', { setItem })).resolves.toBe(true);
    expect(setItem).toHaveBeenCalledWith('paceyourself.runner-launch.1.0:user-a', 'dismissed');

    await expect(acknowledgeRunnerLaunchAnnouncement('user-a', {
      setItem: async () => { throw new Error('disk full'); },
    })).resolves.toBe(false);
  });
});

describe('resolveRunnerLaunchAccessStatus', () => {
  const now = new Date('2026-10-30T12:00:00.000Z');

  it('gives verified paid access precedence over trial and grant labels', () => {
    expect(resolveRunnerLaunchAccessStatus({
      hasPaidPremium: true,
      isTrialActive: true,
      trialEndsAt: '2026-11-02T12:00:00.000Z',
      premiumGrant: { endsAt: '2026-12-01T12:00:00.000Z' },
    }, now)).toEqual({ kind: 'paid' });
  });

  it('uses only valid future trial and grant dates', () => {
    expect(resolveRunnerLaunchAccessStatus({
      hasPaidPremium: false,
      isTrialActive: true,
      trialEndsAt: '2026-11-02T12:00:00.000Z',
      premiumGrant: { endsAt: '2026-11-01T12:00:00.000Z' },
    }, now)).toEqual({ kind: 'trial', endsAt: '2026-11-02T12:00:00.000Z' });

    expect(resolveRunnerLaunchAccessStatus({
      hasPaidPremium: false,
      isTrialActive: true,
      trialEndsAt: 'invalid',
      premiumGrant: { endsAt: '2026-12-01T12:00:00.000Z' },
    }, now)).toEqual({ kind: 'grant', endsAt: '2026-12-01T12:00:00.000Z' });

    expect(resolveRunnerLaunchAccessStatus({
      hasPaidPremium: false,
      isTrialActive: true,
      trialEndsAt: '2026-10-29T12:00:00.000Z',
      premiumGrant: { endsAt: 'also-invalid' },
    }, now)).toEqual({ kind: 'free' });
  });

  it('reports whichever overlapping trial or grant guarantees access for longer', () => {
    expect(resolveRunnerLaunchAccessStatus({
      hasPaidPremium: false,
      isTrialActive: true,
      trialEndsAt: '2026-11-02T12:00:00.000Z',
      premiumGrant: { endsAt: '2026-12-01T12:00:00.000Z' },
    }, now)).toEqual({ kind: 'grant', endsAt: '2026-12-01T12:00:00.000Z' });

    expect(resolveRunnerLaunchAccessStatus({
      hasPaidPremium: false,
      isTrialActive: true,
      trialEndsAt: '2027-01-15T12:00:00.000Z',
      premiumGrant: { endsAt: '2026-12-01T12:00:00.000Z' },
    }, now)).toEqual({ kind: 'trial', endsAt: '2027-01-15T12:00:00.000Z' });
  });
});
