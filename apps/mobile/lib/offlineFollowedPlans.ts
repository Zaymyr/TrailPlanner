import { getFollowedPlan, listFollowedPlans, type FollowedPlan } from './followedPlans';
import { readOfflineCache, removeOfflineCache, resolveOfflineUserId, writeOfflineCache } from './offlineCache';
import { buildUserScopedOfflineKey, isServerUnavailableStatus } from './offlineCacheFormat';

/**
 * Followed (supporter) plans with their device copy: every successful load
 * refreshes the copy, and an unreachable API falls back to it.
 */

type WithOfflineCopy<T> = { value: T; offlineSavedAt: string | null };

function readHttpStatus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

/** An HTTP answer below 500 is authoritative; anything else may be the network. */
function mayUseOfflineCopy(error: unknown): boolean {
  const status = readHttpStatus(error);
  return status === null || isServerUnavailableStatus(status);
}

export async function listFollowedPlansWithOfflineCopy(): Promise<WithOfflineCopy<FollowedPlan[]>> {
  try {
    const follows = await listFollowedPlans();
    const userId = await resolveOfflineUserId();
    if (userId) void writeOfflineCache('followed-plans', buildUserScopedOfflineKey(userId), follows);
    return { value: follows, offlineSavedAt: null };
  } catch (error) {
    if (mayUseOfflineCopy(error)) {
      const userId = await resolveOfflineUserId();
      const stored = userId ? await readOfflineCache<FollowedPlan[]>('followed-plans', buildUserScopedOfflineKey(userId)) : null;
      if (stored && Array.isArray(stored.data)) return { value: stored.data, offlineSavedAt: stored.savedAt };
    }
    throw error;
  }
}

export async function getFollowedPlanWithOfflineCopy(id: string): Promise<WithOfflineCopy<FollowedPlan>> {
  try {
    const follow = await getFollowedPlan(id);
    void storeFollowedPlanOfflineCopy(follow);
    return { value: follow, offlineSavedAt: null };
  } catch (error) {
    const userId = await resolveOfflineUserId();
    const key = userId ? buildUserScopedOfflineKey(userId, id) : null;
    if (mayUseOfflineCopy(error)) {
      const stored = await readOfflineCache<FollowedPlan>('followed-plan', key);
      if (stored?.data?.id === id) return { value: stored.data, offlineSavedAt: stored.savedAt };
    } else {
      // Unfollowed, revoked or no longer shared: the device copy must not outlive the access.
      void removeOfflineCache('followed-plan', key);
    }
    throw error;
  }
}

/** Keeps the device copy in step after a successful change (crew passages, departure time…). */
export async function storeFollowedPlanOfflineCopy(follow: FollowedPlan): Promise<void> {
  const userId = await resolveOfflineUserId();
  if (!userId || !follow?.id) return;
  await writeOfflineCache('followed-plan', buildUserScopedOfflineKey(userId, follow.id), follow);
}
