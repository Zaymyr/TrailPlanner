import { beforeEach, describe, expect, it, vi } from 'vitest';

const setBadgeCountAsync = vi.fn(async () => true);
vi.mock('./notifications', () => ({ getNotificationsModule: async () => ({ setBadgeCountAsync }) }));

describe('app icon badge', () => {
  beforeEach(() => {
    vi.resetModules();
    setBadgeCountAsync.mockClear();
  });

  it('normalizes counts to a non-negative integer', async () => {
    const { normalizeBadgeCount } = await import('./appIconBadge');
    expect(normalizeBadgeCount(3)).toBe(3);
    expect(normalizeBadgeCount(-2)).toBe(0);
    expect(normalizeBadgeCount(2.7)).toBe(2);
    expect(normalizeBadgeCount(Number.NaN)).toBe(0);
  });

  it('sets the icon badge to the unread count and skips repeated values', async () => {
    const { syncAppIconBadge } = await import('./appIconBadge');
    await syncAppIconBadge(2);
    await syncAppIconBadge(2);
    await syncAppIconBadge(0);
    expect(setBadgeCountAsync.mock.calls).toEqual([[2], [0]]);
  });
});
