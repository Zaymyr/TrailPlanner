import type { Session, UserAttributes } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { makeRedirectUri } from 'expo-auth-session';

import { isAnonymousSession } from './appSession';
import { supabase } from './supabase';
import { WEB_API_BASE_URL } from './webApi';

const PENDING_PASSWORD_KEY = 'pending-account-conversion-password';
const PENDING_USER_ID_KEY = 'pending-account-conversion-user-id';
const PENDING_GUEST_MERGE_ACCESS_TOKEN_KEY = 'pending-guest-merge-access-token';
const PENDING_GUEST_MERGE_REFRESH_TOKEN_KEY = 'pending-guest-merge-refresh-token';
const PENDING_GUEST_MERGE_USER_ID_KEY = 'pending-guest-merge-user-id';

type BeginAnonymousEmailUpgradeParams = {
  email: string;
  password: string;
  fullName?: string;
};

export function getAuthRedirectUri() {
  return makeRedirectUri({
    scheme: 'paceyourself',
    path: 'auth/callback',
  });
}

export async function clearPendingAccountConversion() {
  await Promise.all([
    SecureStore.deleteItemAsync(PENDING_PASSWORD_KEY),
    SecureStore.deleteItemAsync(PENDING_USER_ID_KEY),
  ]);
}

export async function clearPendingGuestMerge() {
  await Promise.all([
    SecureStore.deleteItemAsync(PENDING_GUEST_MERGE_ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(PENDING_GUEST_MERGE_REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(PENDING_GUEST_MERGE_USER_ID_KEY),
  ]);
}

export async function hasPendingGuestMerge() {
  const pendingUserId = await SecureStore.getItemAsync(PENDING_GUEST_MERGE_USER_ID_KEY);
  return Boolean(pendingUserId);
}

export async function preparePendingGuestMerge(session: Session | null | undefined) {
  if (!session || !isAnonymousSession(session) || !session.access_token || !session.user.id) {
    await clearPendingGuestMerge();
    return;
  }

  await Promise.all([
    SecureStore.setItemAsync(PENDING_GUEST_MERGE_ACCESS_TOKEN_KEY, session.access_token),
    SecureStore.setItemAsync(PENDING_GUEST_MERGE_REFRESH_TOKEN_KEY, session.refresh_token),
    SecureStore.setItemAsync(PENDING_GUEST_MERGE_USER_ID_KEY, session.user.id),
  ]);
}

export async function finalizePendingGuestMerge(sessionOverride?: Session | null) {
  const session =
    sessionOverride ??
    (await supabase.auth.getSession()).data.session;

  if (!session || isAnonymousSession(session) || !session.access_token) {
    return { merged: false as const, reason: 'session-not-ready' as const };
  }

  const [sourceAccessToken, sourceRefreshToken, sourceUserId] = await Promise.all([
    SecureStore.getItemAsync(PENDING_GUEST_MERGE_ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(PENDING_GUEST_MERGE_REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(PENDING_GUEST_MERGE_USER_ID_KEY),
  ]);

  if (!sourceAccessToken || !sourceUserId) {
    return { merged: false as const, reason: 'no-pending-guest-merge' as const };
  }

  if (session.user.id === sourceUserId) {
    await clearPendingGuestMerge();
    return { merged: false as const, reason: 'same-user' as const };
  }

  try {
    const response = await fetch(`${WEB_API_BASE_URL}/api/account/merge-guest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceAccessToken,
        sourceRefreshToken: sourceRefreshToken || undefined,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      return {
        merged: false as const,
        reason: 'merge-request-failed' as const,
        error: payload?.message ?? 'Unable to merge guest data.',
      };
    }

    await clearPendingGuestMerge();
    return { merged: true as const, reason: 'completed' as const };
  } catch (error) {
    return {
      merged: false as const,
      reason: 'merge-request-failed' as const,
      error: error instanceof Error ? error.message : 'Unable to merge guest data.',
    };
  }
}

export async function finalizePendingAccountConversion(sessionOverride?: Session | null) {
  const session =
    sessionOverride ??
    (await supabase.auth.getSession()).data.session;

  if (!session || isAnonymousSession(session)) {
    return { completed: false as const, reason: 'session-not-ready' as const };
  }

  const pendingPassword = await SecureStore.getItemAsync(PENDING_PASSWORD_KEY);
  const pendingUserId = await SecureStore.getItemAsync(PENDING_USER_ID_KEY);

  if (!pendingPassword || !pendingUserId) {
    return { completed: false as const, reason: 'no-pending-password' as const };
  }

  if (session.user.id !== pendingUserId) {
    await clearPendingAccountConversion();
    return { completed: false as const, reason: 'session-user-changed' as const };
  }

  const { error } = await supabase.auth.updateUser({
    password: pendingPassword,
  });

  if (error) {
    return {
      completed: false as const,
      reason: 'password-update-failed' as const,
      error,
    };
  }

  await clearPendingAccountConversion();

  return { completed: true as const, reason: 'completed' as const };
}

export async function beginAnonymousEmailUpgrade({
  email,
  password,
  fullName,
}: BeginAnonymousEmailUpgradeParams) {
  const trimmedEmail = email.trim();
  const trimmedFullName = fullName?.trim() ?? '';
  const attributes: UserAttributes = {
    email: trimmedEmail,
    data: trimmedFullName ? { full_name: trimmedFullName } : undefined,
  };

  const {
    data: { session: currentSession },
  } = await supabase.auth.getSession();

  if (!currentSession?.user.id) {
    return {
      data: { user: null },
      error: new Error('Anonymous session is missing.'),
      passwordApplied: false,
    };
  }

  await Promise.all([
    SecureStore.setItemAsync(PENDING_PASSWORD_KEY, password),
    SecureStore.setItemAsync(PENDING_USER_ID_KEY, currentSession.user.id),
  ]);

  const { data, error } = await supabase.auth.updateUser(attributes, {
    emailRedirectTo: getAuthRedirectUri(),
  });

  if (error) {
    await clearPendingAccountConversion();
    return { data, error, passwordApplied: false };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (trimmedFullName && session?.user.id) {
    await supabase.from('user_profiles').upsert(
      {
        user_id: session.user.id,
        full_name: trimmedFullName,
      },
      { onConflict: 'user_id' }
    );
  }

  const passwordResult = await finalizePendingAccountConversion(session);

  return {
    data,
    error: null,
    passwordApplied: passwordResult.completed,
  };
}
