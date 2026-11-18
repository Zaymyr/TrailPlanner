import { getNotificationsModule } from './notifications';

/**
 * Mirrors the runner's unread inbox count on the app icon (iOS badge number,
 * Android launchers that support counts). Only unread messages count: pending
 * guided tours keep their in-app dots and never badge the icon.
 */
let lastBadgeCount: number | null = null;

export function normalizeBadgeCount(count: number) {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export async function syncAppIconBadge(count: number) {
  const next = normalizeBadgeCount(count);
  if (next === lastBadgeCount) return;
  lastBadgeCount = next;
  try {
    const Notifications = await getNotificationsModule();
    await Notifications?.setBadgeCountAsync(next);
  } catch (error) {
    // Unsupported launcher or missing badge permission: the in-app dots still guide the runner.
    lastBadgeCount = null;
    console.warn('Unable to update the app icon badge.', error);
  }
}
