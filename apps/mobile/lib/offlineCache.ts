import type { Session } from '@supabase/supabase-js';
import { Directory, File, Paths } from 'expo-file-system';

import {
  buildOfflineCacheFileName,
  parseOfflineCacheEntry,
  parseStoredAuthSession,
  serializeOfflineCacheEntry,
  type OfflineCacheEntry,
  type OfflineCacheKind,
} from './offlineCacheFormat';
import { supabase } from './supabase';

/**
 * Device copies of the last successfully loaded RaceBook, Supporter Guide and
 * plans, so they stay readable without network. Stored as JSON files in the
 * app's document directory (AsyncStorage's per-entry limit on Android is too
 * small for course profiles). Every call is best effort and never throws.
 */
const OFFLINE_CACHE_DIRECTORY = 'offline-cache';

function getCacheDirectory(create: boolean): Directory | null {
  const directory = new Directory(Paths.document, OFFLINE_CACHE_DIRECTORY);
  if (!directory.exists) {
    if (!create) return null;
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

export async function writeOfflineCache<T>(kind: OfflineCacheKind, key: string, data: T): Promise<void> {
  if (!key) return;
  try {
    const directory = getCacheDirectory(true);
    if (!directory) return;
    const file = new File(directory, buildOfflineCacheFileName(kind, key));
    if (!file.exists) file.create({ intermediates: true });
    file.write(serializeOfflineCacheEntry(data));
  } catch (error) {
    console.warn('Unable to store the offline copy.', kind, error);
  }
}

export async function readOfflineCache<T>(kind: OfflineCacheKind, key: string | null | undefined): Promise<OfflineCacheEntry<T> | null> {
  if (!key) return null;
  try {
    const directory = getCacheDirectory(false);
    if (!directory) return null;
    const file = new File(directory, buildOfflineCacheFileName(kind, key));
    if (!file.exists) return null;
    return parseOfflineCacheEntry<T>(await file.text());
  } catch (error) {
    console.warn('Unable to read the offline copy.', kind, error);
    return null;
  }
}

export async function removeOfflineCache(kind: OfflineCacheKind, key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    const directory = getCacheDirectory(false);
    if (!directory) return;
    const file = new File(directory, buildOfflineCacheFileName(kind, key));
    if (file.exists) file.delete();
  } catch {
    // Best effort: a stale copy is replaced or ignored on the next load.
  }
}

/** Drops every offline copy (sign-out). */
export function clearOfflineCache(): void {
  try {
    const directory = getCacheDirectory(false);
    directory?.delete();
  } catch (error) {
    console.warn('Unable to clear the offline copies.', error);
  }
}

/**
 * The session persisted by supabase-js, read directly from its storage. When
 * the access token has expired and the refresh fails for lack of network,
 * `getSession()` reports no session although the account is still signed in
 * on the device; this keeps the offline copies reachable in that case.
 */
export function readStoredAuthSession(): Session | null {
  try {
    const auth = supabase?.auth as { storageKey?: string; storage?: { getItem(key: string): unknown } } | undefined;
    const storageKey = auth?.storageKey;
    const raw = storageKey ? auth?.storage?.getItem(storageKey) : null;
    if (typeof raw !== 'string') return null;
    const parsed = parseStoredAuthSession(raw);
    return parsed ? (parsed.session as unknown as Session) : null;
  } catch {
    return null;
  }
}

/** Current account id, falling back to the persisted session while offline. */
export async function resolveOfflineUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id;
    if (typeof userId === 'string' && userId) return userId;
  } catch {
    // Fall through to the persisted session.
  }
  return readStoredAuthSession()?.user?.id ?? null;
}
