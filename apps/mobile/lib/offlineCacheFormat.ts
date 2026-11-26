/**
 * Pure helpers for the on-device offline copies of the RaceBook, the
 * Supporter Guide and the runner/supporter plans (see
 * docs/03-business-rules/mobile-offline-access.md). The file-system IO lives in
 * `offlineCache.ts`; everything here is runtime-agnostic so it can be tested.
 */

export const OFFLINE_CACHE_FORMAT_VERSION = 1;

export type OfflineCacheKind =
  | 'racebook'
  | 'supporter-guide'
  | 'plan'
  | 'plan-race-start'
  | 'plans-list'
  | 'followed-plan'
  | 'followed-plans'
  | 'course-weather'
  | 'course-terrain';

export type OfflineCacheEntry<T> = {
  /** ISO timestamp of the successful network load that produced the copy. */
  savedAt: string;
  data: T;
};

type StoredEnvelope = {
  v?: unknown;
  savedAt?: unknown;
  data?: unknown;
};

export function buildOfflineCacheFileName(kind: OfflineCacheKind, key: string): string {
  const safeKey = key.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 180);
  return `${kind}--${safeKey}.json`;
}

/** Plans belong to an account: their copies are keyed by user so an account switch never exposes another runner's plan. */
export function buildUserScopedOfflineKey(userId: string, resourceId?: string | null): string {
  return resourceId ? `${userId}_${resourceId}` : userId;
}

export function serializeOfflineCacheEntry<T>(data: T, savedAt: Date = new Date()): string {
  return JSON.stringify({ v: OFFLINE_CACHE_FORMAT_VERSION, savedAt: savedAt.toISOString(), data });
}

export function parseOfflineCacheEntry<T>(raw: string | null | undefined): OfflineCacheEntry<T> | null {
  if (!raw) return null;
  let parsed: StoredEnvelope | null = null;
  try {
    parsed = JSON.parse(raw) as StoredEnvelope;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  // A copy written by another format version is ignored rather than guessed at.
  if (parsed.v !== OFFLINE_CACHE_FORMAT_VERSION) return null;
  if (typeof parsed.savedAt !== 'string' || Number.isNaN(Date.parse(parsed.savedAt))) return null;
  if (parsed.data === undefined || parsed.data === null) return null;
  return { savedAt: parsed.savedAt, data: parsed.data as T };
}

// fetch/PostgREST/GoTrue messages, plus the iOS (NSURLError) and Android
// (OkHttp) wording surfaced by expo-updates when the device has no network.
const NETWORK_FAILURE_PATTERN = /network request failed|failed to fetch|network ?error|timed out|aborted|internet connection|offline|not connected to the internet|unable to resolve host|failed to connect|could not connect to the server/i;

/**
 * True when an error means the server could not be reached (no network,
 * timeout, aborted request) as opposed to an answer from the server.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; message?: unknown; status?: unknown };
  if (candidate.name === 'AuthRetryableFetchError' || candidate.name === 'AbortError') return true;
  if (typeof candidate.status === 'number' && candidate.status > 0) return false;
  return typeof candidate.message === 'string' && NETWORK_FAILURE_PATTERN.test(candidate.message);
}

/** PostgREST reports a transport failure (no HTTP answer at all) with status 0. */
export function isPostgrestNetworkFailure(result: { error?: unknown; status?: number | null } | null | undefined): boolean {
  if (!result?.error) return false;
  return result.status === 0 || isNetworkFailure(result.error);
}

/** A 5xx answer is treated like an unreachable server: the last published copy stays usable. */
export function isServerUnavailableStatus(status: number): boolean {
  return status >= 500;
}

export type StoredAuthSessionSummary = {
  userId: string;
  isAnonymous: boolean;
};

/**
 * Reads the minimal identity out of the session JSON persisted by supabase-js.
 * Used only when the token refresh failed for lack of network, so the app can
 * keep showing the device's offline copies for that account.
 */
export function parseStoredAuthSession(raw: string | null | undefined): (StoredAuthSessionSummary & { session: Record<string, unknown> }) | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const session = parsed && typeof parsed === 'object' && 'currentSession' in parsed
      ? (parsed.currentSession as Record<string, unknown> | null)
      : parsed;
    if (!session || typeof session !== 'object') return null;
    const user = session.user as { id?: unknown; is_anonymous?: unknown } | undefined;
    if (!user || typeof user.id !== 'string' || !user.id) return null;
    if (typeof session.refresh_token !== 'string' || !session.refresh_token) return null;
    return { userId: user.id, isAnonymous: user.is_anonymous === true, session };
  } catch {
    return null;
  }
}

export function formatOfflineSavedAt(savedAt: string, locale: 'fr' | 'en', now: Date = new Date()): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return '';
  const tag = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const time = date.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return time;
  const day = date.toLocaleDateString(tag, { day: '2-digit', month: '2-digit' });
  return `${day} ${time}`;
}
