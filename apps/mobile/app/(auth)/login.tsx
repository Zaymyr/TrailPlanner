import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Link } from 'expo-router';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  clearPendingGuestMerge,
  getAuthRedirectUri,
  preparePendingGuestMerge,
} from '../../lib/accountConversion';
import { isAnonymousSession } from '../../lib/appSession';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { ensureTrialStatusForSession } from '../../lib/trial';

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

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');
type AppleAuthenticationModule = typeof import('expo-apple-authentication');

function shouldFallbackToGuestMerge(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('identity') &&
    (message.includes('already') || message.includes('linked'))
  );
}

export default function LoginScreen() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const nativeGoogleEnabled = canUseNativeGoogleSignIn();
  const [googleModule, setGoogleModule] = useState<GoogleSignInModule | null>(null);
  const [appleModule, setAppleModule] = useState<AppleAuthenticationModule | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const isGuestSession = isAnonymousSession(session);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (mounted) {
        setSession(data.session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      if (mounted) {
        setSession(nextSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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

  async function handleNativeGoogleLogin() {
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
  }

  async function handleBrowserGoogleLogin() {
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
    if (!data.url) throw new Error(t.auth.noOauthUrl);

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
  }

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    try {
      if (nativeGoogleEnabled && googleModule) {
        await handleNativeGoogleLogin();
      } else {
        await handleBrowserGoogleLogin();
      }
    } catch (e) {
      if (googleModule?.isErrorWithCode(e)) {
        if (
          e.code === googleModule.statusCodes.SIGN_IN_CANCELLED ||
          e.code === googleModule.statusCodes.IN_PROGRESS
        ) {
          setLoading(false);
          return;
        }
      }
      console.error('Google login error:', e);
      setError(t.auth.googleError);
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleLogin() {
    if (!appleModule || Platform.OS !== 'ios') return;

    setError(null);
    setLoading(true);

    try {
      const credential = await appleModule.signInAsync({
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

      const firstName = credential.fullName?.givenName?.trim() ?? '';
      const lastName = credential.fullName?.familyName?.trim() ?? '';
      const nextFullName = [firstName, lastName].filter(Boolean).join(' ').trim();

      if (data.user?.id && nextFullName) {
        await supabase.from('user_profiles').upsert(
          {
            user_id: data.user.id,
            full_name: nextFullName,
          },
          { onConflict: 'user_id' }
        );
      }

      await ensureTrialStatusForSession(data.session);
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
        setLoading(false);
        return;
      }

      console.error('Apple login error:', e);
      setError(t.auth.appleError);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setError(null);
    setLoading(true);

    if (isGuestSession) {
      await preparePendingGuestMerge(session);
    } else {
      await clearPendingGuestMerge();
    }

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (loginError) {
      await clearPendingGuestMerge();
      setError(loginError.message);
      return;
    }

    await ensureTrialStatusForSession(data.session);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Pace Yourself</Text>
        <Text style={styles.subtitle}>
          {isGuestSession ? t.auth.guestLoginSubtitle : t.auth.loginSubtitle}
        </Text>

        {isGuestSession ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{t.auth.guestModeTitle}</Text>
            <Text style={styles.infoBody}>{t.auth.guestLoginHint}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder={t.auth.emailPlaceholder}
          placeholderTextColor={Colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <TextInput
          style={styles.input}
          placeholder={t.auth.passwordPlaceholder}
          placeholderTextColor={Colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? t.auth.loggingIn : t.auth.loginCta}</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {appleModule && appleAvailable ? (
          <>
            <appleModule.AppleAuthenticationButton
              buttonStyle={appleModule.AppleAuthenticationButtonStyle.BLACK}
              buttonType={appleModule.AppleAuthenticationButtonType.SIGN_IN}
              cornerRadius={12}
              onPress={() => void handleAppleLogin()}
              style={styles.appleButton}
            />
            <View style={styles.altSpacing} />
          </>
        ) : null}

        {nativeGoogleEnabled && googleModule ? (
          <View style={[styles.googleNativeButtonWrap, loading && styles.buttonDisabled]}>
            <googleModule.GoogleSigninButton
              color={googleModule.GoogleSigninButton.Color.Light}
              disabled={loading}
              onPress={handleGoogleLogin}
              size={googleModule.GoogleSigninButton.Size.Wide}
              style={styles.googleNativeButton}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.googleButton, loading && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Text style={styles.googleButtonText}>{t.auth.googleCta}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.signupRow}>
          <Text style={styles.signupText}>{t.auth.noAccount} </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={styles.signupLink}>{t.auth.signUpLink}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.brandPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  infoTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  infoBody: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    color: Colors.danger,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.textOnBrand,
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  appleButton: {
    width: '100%',
    height: 52,
  },
  altSpacing: {
    height: 8,
  },
  googleButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  googleButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  googleNativeButtonWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  googleNativeButton: {
    width: '100%',
    height: 52,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  signupLink: {
    color: Colors.brandPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
