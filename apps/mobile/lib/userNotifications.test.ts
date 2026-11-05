import { describe, expect, it, vi } from 'vitest';
import {
  mergeUserNotificationPages,
  removeUserNotification,
  setNotificationsRead,
  shouldOpenNotificationsTab,
  shouldShowProfileAttentionDot,
  type UserNotification,
} from './userNotifications';

vi.mock('./supabase', () => ({ supabase: {} }));

function notification(
  id: string,
  createdAt: string,
  readAt: string | null = null,
): UserNotification {
  return {
    id,
    userId: 'user-1',
    raceRequestId: null,
    feedbackId: null,
    kind: 'admin_message',
    title: `Title ${id}`,
    body: `Body ${id}`,
    readAt,
    createdAt,
  };
}

describe('user notification collection helpers', () => {
  it('drops a deleted message from the inbox list', () => {
    const list = [notification('a', '2026-11-05T10:00:00.000Z'), notification('b', '2026-11-04T10:00:00.000Z')];
    expect(removeUserNotification(list, 'a').map((item) => item.id)).toEqual(['b']);
  });

  it('merges paginated results without duplicates and keeps newest first', () => {
    const result = mergeUserNotificationPages(
      [notification('older', '2026-11-01T10:00:00.000Z')],
      [
        notification('newer', '2026-11-05T10:00:00.000Z'),
        notification('older', '2026-11-01T10:00:00.000Z', '2026-11-05T11:00:00.000Z'),
      ],
    );

    expect(result.map((item) => item.id)).toEqual(['newer', 'older']);
    expect(result[1].readAt).toBe('2026-11-05T11:00:00.000Z');
  });

  it('marks only requested unread rows as read', () => {
    const existingReadAt = '2026-11-03T10:00:00.000Z';
    const nextReadAt = '2026-11-05T10:00:00.000Z';
    const result = setNotificationsRead(
      [
        notification('target', '2026-11-05T09:00:00.000Z'),
        notification('other', '2026-11-04T09:00:00.000Z'),
        notification('already-read', '2026-11-03T09:00:00.000Z', existingReadAt),
      ],
      new Set(['target', 'already-read']),
      nextReadAt,
    );

    expect(result.find((item) => item.id === 'target')?.readAt).toBe(nextReadAt);
    expect(result.find((item) => item.id === 'other')?.readAt).toBeNull();
    expect(result.find((item) => item.id === 'already-read')?.readAt).toBe(existingReadAt);
  });

  it('opens the notification tab for an explicit tab or notification deep link', () => {
    expect(shouldOpenNotificationsTab('notifications', undefined)).toBe(true);
    expect(shouldOpenNotificationsTab(undefined, 'notification-id')).toBe(true);
    expect(shouldOpenNotificationsTab('settings', undefined)).toBe(false);
  });

  it('keeps one profile attention dot for onboarding or unread messages', () => {
    expect(shouldShowProfileAttentionDot({ hasPendingOnboarding: true, hasUnreadNotifications: false })).toBe(true);
    expect(shouldShowProfileAttentionDot({ hasPendingOnboarding: false, hasUnreadNotifications: true })).toBe(true);
    expect(shouldShowProfileAttentionDot({ hasPendingOnboarding: true, hasUnreadNotifications: true })).toBe(true);
    expect(shouldShowProfileAttentionDot({ hasPendingOnboarding: false, hasUnreadNotifications: false })).toBe(false);
  });
});
