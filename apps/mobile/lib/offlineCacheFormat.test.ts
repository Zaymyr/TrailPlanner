import { describe, expect, it } from 'vitest';

import {
  OFFLINE_CACHE_FORMAT_VERSION,
  buildOfflineCacheFileName,
  buildUserScopedOfflineKey,
  formatOfflineSavedAt,
  isNetworkFailure,
  isPostgrestNetworkFailure,
  isServerUnavailableStatus,
  parseOfflineCacheEntry,
  parseStoredAuthSession,
  serializeOfflineCacheEntry,
} from './offlineCacheFormat';

describe('offline cache entries', () => {
  it('round-trips data with the save timestamp', () => {
    const raw = serializeOfflineCacheEntry({ race: { id: 'race-1' } }, new Date('2026-11-17T13:05:00.000Z'));
    expect(parseOfflineCacheEntry<{ race: { id: string } }>(raw)).toEqual({
      savedAt: '2026-11-17T13:05:00.000Z',
      data: { race: { id: 'race-1' } },
    });
  });

  it('ignores corrupt, empty or other-version copies', () => {
    expect(parseOfflineCacheEntry(null)).toBeNull();
    expect(parseOfflineCacheEntry('{not json')).toBeNull();
    expect(parseOfflineCacheEntry(JSON.stringify({ v: OFFLINE_CACHE_FORMAT_VERSION + 1, savedAt: '2026-11-17T13:05:00.000Z', data: {} }))).toBeNull();
    expect(parseOfflineCacheEntry(JSON.stringify({ v: OFFLINE_CACHE_FORMAT_VERSION, savedAt: 'yesterday', data: {} }))).toBeNull();
    expect(parseOfflineCacheEntry(JSON.stringify({ v: OFFLINE_CACHE_FORMAT_VERSION, savedAt: '2026-11-17T13:05:00.000Z', data: null }))).toBeNull();
  });

  it('builds file-system safe names and user-scoped keys', () => {
    expect(buildOfflineCacheFileName('racebook', 'race/../1')).toBe('racebook--race____1.json');
    expect(buildUserScopedOfflineKey('user-1', 'plan-1')).toBe('user-1_plan-1');
    expect(buildUserScopedOfflineKey('user-1')).toBe('user-1');
  });
});

describe('network failure detection', () => {
  it('recognizes transport failures but not server answers', () => {
    expect(isNetworkFailure(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkFailure({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toBe(true);
    expect(isNetworkFailure({ name: 'AbortError', message: 'Aborted' })).toBe(true);
    expect(isNetworkFailure(new Error('Request timed out'))).toBe(true);
    expect(isNetworkFailure(new Error('The Internet connection appears to be offline.'))).toBe(true);
    expect(isNetworkFailure(new Error('Unable to resolve host "u.expo.dev": No address associated with hostname'))).toBe(true);
    expect(isNetworkFailure(new Error('Failed to download manifest: invalid signature'))).toBe(false);
    expect(isNetworkFailure(Object.assign(new Error('Not found'), { status: 404 }))).toBe(false);
    expect(isNetworkFailure(new Error('authentication_required'))).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });

  it('reads PostgREST transport failures from status 0', () => {
    expect(isPostgrestNetworkFailure({ error: { message: 'FetchError: Network request failed', code: '' }, status: 0 })).toBe(true);
    expect(isPostgrestNetworkFailure({ error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, status: 406 })).toBe(false);
    expect(isPostgrestNetworkFailure({ error: null, status: 200 })).toBe(false);
  });

  it('treats 5xx as an unavailable server', () => {
    expect(isServerUnavailableStatus(503)).toBe(true);
    expect(isServerUnavailableStatus(404)).toBe(false);
  });
});

describe('persisted auth session', () => {
  const session = { access_token: 'a', refresh_token: 'r', expires_at: 1, user: { id: 'user-1', is_anonymous: false } };

  it('reads the account of the persisted session', () => {
    expect(parseStoredAuthSession(JSON.stringify(session))).toMatchObject({ userId: 'user-1', isAnonymous: false });
    expect(parseStoredAuthSession(JSON.stringify({ currentSession: session }))).toMatchObject({ userId: 'user-1' });
  });

  it('rejects sessions without account or refresh token', () => {
    expect(parseStoredAuthSession(JSON.stringify({ ...session, refresh_token: '' }))).toBeNull();
    expect(parseStoredAuthSession(JSON.stringify({ ...session, user: {} }))).toBeNull();
    expect(parseStoredAuthSession('nope')).toBeNull();
  });
});

describe('saved-at label', () => {
  it('shows the time alone on the same day and the date otherwise', () => {
    const now = new Date(2026, 10, 18, 9, 0);
    expect(formatOfflineSavedAt(new Date(2026, 10, 18, 7, 5).toISOString(), 'fr', now)).toBe('07:05');
    expect(formatOfflineSavedAt(new Date(2026, 10, 17, 14, 5).toISOString(), 'fr', now)).toBe('17/11 14:05');
    expect(formatOfflineSavedAt('bad', 'fr', now)).toBe('');
  });
});
