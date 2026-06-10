import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

import {
  clearPendingGuestMerge,
  preparePendingGuestMerge,
} from '../lib/accountConversion';
import { isAnonymousSession } from '../lib/appSession';
import { supabase } from '../lib/supabase';
import { ensureTrialStatusForSession } from '../lib/trial';

export type AppleAuthenticationModule = typeof import('expo-apple-authentication');

type UseAppleAuthParams = {
  session: Session | null;
};

function shouldFallbackToGuestMerge(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('identity') &&
    (message.includes('already') || message.includes('linked'))
  );
}

function createAppleNonce() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let nonce = '';

  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return nonce;
}

async function createAppleNonceChallenge(rawNonce: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
}

export function isAppleAuthCanceled(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ERR_REQUEST_CANCELED'
  );
}

function formatAppleFullName(
  appleModule: AppleAuthenticationModule,
  fullName: NonNullable<Awaited<ReturnType<AppleAuthenticationModule['signInAsync']>>['fullName']>,
) {
  const formatted = appleModule.formatFullName(fullName).trim();
  if (formatted) return formatted;

  return [
    fullName.givenName,
    fullName.middleName,
    fullName.familyName,
  ].filter(Boolean).join(' ').trim();
}

export function useAppleAuth({ session }: UseAppleAuthParams) {
  const [appleModule, setAppleModule] = useState<AppleAuthenticationModule | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const isGuestSession = isAnonymousSession(session);

  useEffect(() => {
    let mounted = true;

    if (Platform.OS !== 'ios') {
      setAppleModule(null);
      setAppleAvailable(false);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const nextAppleModule = await import('expo-apple-authentication');
        const nextAppleAvailable = await nextAppleModule.isAvailableAsync();

        if (!mounted) return;

        setAppleModule(nextAppleModule);
        setAppleAvailable(nextAppleAvailable);
      } catch (appleImportError) {
        console.warn('Apple Sign-In unavailable in this build.', appleImportError);
        if (mounted) {
          setAppleModule(null);
          setAppleAvailable(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleAppleLogin = useCallback(async () => {
    if (!appleModule || Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is not available on this device.');
    }

    const nonce = createAppleNonce();
    // Apple receives the SHA-256 challenge; Supabase verifies the ID token with the raw nonce.
    const nonceChallenge = await createAppleNonceChallenge(nonce);
    const credential = await appleModule.signInAsync({
      nonce: nonceChallenge,
      requestedScopes: [
        appleModule.AppleAuthenticationScope.FULL_NAME,
        appleModule.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token.');
    }

    const appleCredentials = {
      provider: 'apple' as const,
      token: credential.identityToken,
      nonce,
    };
    let data;
    let appleError;

    if (isGuestSession) {
      const linkResult = await supabase.auth.linkIdentity(appleCredentials);

      if (!linkResult.error) {
        await clearPendingGuestMerge();
        data = linkResult.data;
        appleError = null;
      } else if (shouldFallbackToGuestMerge(linkResult.error)) {
        await preparePendingGuestMerge(session);
        const signInResult = await supabase.auth.signInWithIdToken(appleCredentials);
        data = signInResult.data;
        appleError = signInResult.error;
        if (appleError) {
          await clearPendingGuestMerge();
        }
      } else {
        throw linkResult.error;
      }
    } else {
      const signInResult = await supabase.auth.signInWithIdToken(appleCredentials);
      data = signInResult.data;
      appleError = signInResult.error;
    }

    if (appleError) throw appleError;

    const nextFullName = credential.fullName
      ? formatAppleFullName(appleModule, credential.fullName)
      : '';

    if (data.user?.id && nextFullName) {
      const [profileResult, metadataResult] = await Promise.all([
        supabase.from('user_profiles').upsert(
          {
            user_id: data.user.id,
            full_name: nextFullName,
          },
          { onConflict: 'user_id' }
        ),
        supabase.auth.updateUser({
          data: { full_name: nextFullName },
        }),
      ]);

      if (profileResult.error) {
        console.warn('Unable to save Apple full name to profile.', profileResult.error);
      }

      if (metadataResult.error) {
        console.warn('Unable to save Apple full name to auth metadata.', metadataResult.error);
      }
    }

    await ensureTrialStatusForSession(data.session);
  }, [appleModule, isGuestSession, session]);

  return {
    appleModule,
    appleAvailable,
    handleAppleLogin,
    isAppleAuthCanceled,
  };
}
