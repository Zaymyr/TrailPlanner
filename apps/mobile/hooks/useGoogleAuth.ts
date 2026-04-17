import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';

import {
  clearPendingGuestMerge,
  getAuthRedirectUri,
  preparePendingGuestMerge,
} from '../lib/accountConversion';
import { isAnonymousSession } from '../lib/appSession';
import { supabase } from '../lib/supabase';
import { ensureTrialStatusForSession } from '../lib/trial';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';

function canUseNativeGoogleSignIn() {
  if (Platform.OS === 'web') return false;
  if (Constants.executionEnvironment === 'storeClient') return false;
  if (!GOOGLE_WEB_CLIENT_ID) return false;
  if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) return false;
  return true;
}

function shouldFallbackToGuestMerge(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return message.includes('identity') && (message.includes('already') || message.includes('linked'));
}

export type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

type UseGoogleAuthParams = {
  noOauthUrlMessage: string;
  session: Session | null;
};

export function useGoogleAuth({ noOauthUrlMessage, session }: UseGoogleAuthParams) {
  const nativeGoogleEnabled = canUseNativeGoogleSignIn();
  const [googleModule, setGoogleModule] = useState<GoogleSignInModule | null>(null);
  const isGuestSession = isAnonymousSession(session);

  useEffect(() => {
    let mounted = true;

    if (!nativeGoogleEnabled) {
      setGoogleModule(null);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const nextGoogleModule = await import('@react-native-google-signin/google-signin');
        nextGoogleModule.GoogleSignin.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID,
          iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
          scopes: ['email', 'profile'],
        });

        if (mounted) {
          setGoogleModule(nextGoogleModule);
        }
      } catch (googleImportError) {
        console.warn('Native Google Sign-In unavailable, falling back to browser auth.', googleImportError);
        if (mounted) {
          setGoogleModule(null);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [nativeGoogleEnabled]);

  const handleNativeGoogleLogin = useCallback(async () => {
    if (!googleModule) {
      throw new Error('Native Google Sign-In module is not available.');
    }

    if (Platform.OS === 'android') {
      await googleModule.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const signInResponse = await googleModule.GoogleSignin.signIn();
    if (!googleModule.isSuccessResponse(signInResponse)) {
      return;
    }

    const tokenResponse = await googleModule.GoogleSignin.getTokens().catch(() => null);
    const idToken = tokenResponse?.idToken ?? signInResponse.data.idToken;
    const accessToken = tokenResponse?.accessToken;

    if (!idToken) {
      throw new Error('Google did not return an ID token.');
    }

    const googleCredentials = {
      provider: 'google' as const,
      token: idToken,
      access_token: accessToken,
    };
    let data;
    let idTokenError;

    if (isGuestSession) {
      const linkResult = await supabase.auth.linkIdentity(googleCredentials);

      if (!linkResult.error) {
        await clearPendingGuestMerge();
        data = linkResult.data;
        idTokenError = null;
      } else if (shouldFallbackToGuestMerge(linkResult.error)) {
        await preparePendingGuestMerge(session);
        const signInResult = await supabase.auth.signInWithIdToken(googleCredentials);
        data = signInResult.data;
        idTokenError = signInResult.error;
        if (idTokenError) {
          await clearPendingGuestMerge();
        }
      } else {
        throw linkResult.error;
      }
    } else {
      const signInResult = await supabase.auth.signInWithIdToken(googleCredentials);
      data = signInResult.data;
      idTokenError = signInResult.error;
    }

    if (idTokenError) throw idTokenError;

    await ensureTrialStatusForSession(data.session);
  }, [googleModule, isGuestSession, session]);

  const handleBrowserGoogleLogin = useCallback(async () => {
    const redirectUri = getAuthRedirectUri();

    const oauthCredentials = {
      provider: 'google' as const,
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    };
    let data;
    let oauthError;

    if (isGuestSession) {
      const linkResult = await supabase.auth.linkIdentity(oauthCredentials);

      if (!linkResult.error) {
        await clearPendingGuestMerge();
        data = linkResult.data;
        oauthError = null;
      } else if (shouldFallbackToGuestMerge(linkResult.error)) {
        await preparePendingGuestMerge(session);
        const signInResult = await supabase.auth.signInWithOAuth(oauthCredentials);
        data = signInResult.data;
        oauthError = signInResult.error;
        if (oauthError) {
          await clearPendingGuestMerge();
        }
      } else {
        throw linkResult.error;
      }
    } else {
      const signInResult = await supabase.auth.signInWithOAuth(oauthCredentials);
      data = signInResult.data;
      oauthError = signInResult.error;
    }

    if (oauthError) throw oauthError;
    if (!data.url) throw new Error(noOauthUrlMessage);

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    if (result.type === 'success' && result.url) {
      const fragment = result.url.includes('#') ? result.url.split('#')[1] : '';
      const query = result.url.includes('?') ? result.url.split('?')[1] : '';
      const params = new URLSearchParams(fragment || query);

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = new URLSearchParams(query).get('code');

      if (accessToken && refreshToken) {
        const { data } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        await ensureTrialStatusForSession(data.session);
      } else if (code) {
        const { data } = await supabase.auth.exchangeCodeForSession(code);
        await ensureTrialStatusForSession(data.session);
      }
    }
  }, [isGuestSession, noOauthUrlMessage, session]);

  const handleGoogleLogin = useCallback(async () => {
    if (nativeGoogleEnabled && googleModule) {
      await handleNativeGoogleLogin();
      return;
    }

    await handleBrowserGoogleLogin();
  }, [googleModule, handleBrowserGoogleLogin, handleNativeGoogleLogin, nativeGoogleEnabled]);

  return {
    googleModule,
    nativeGoogleEnabled,
    handleGoogleLogin,
  };
}
