import { useEffect, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Text } from '../../components/themed/Text';
import { Link } from 'expo-router';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { clearPendingGuestMerge, preparePendingGuestMerge } from '../../lib/accountConversion';
import { isAnonymousSession } from '../../lib/appSession';
import { useAppleAuth } from '../../hooks/useAppleAuth';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { ensureTrialStatusForSession } from '../../lib/trial';

export default function LoginScreen() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const isGuestSession = isAnonymousSession(session);
  const {
    appleModule,
    appleAvailable,
    handleAppleLogin: signInWithApple,
    isAppleAuthCanceled,
  } = useAppleAuth({ session });
  const { googleModule, nativeGoogleEnabled, googleAvailable, handleGoogleLogin: signInWithGoogle } = useGoogleAuth({
    noOauthUrlMessage: t.auth.noOauthUrl,
    session,
  });
  const hasSocialAuth = Boolean((appleModule && appleAvailable) || googleAvailable);

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

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
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
    if (!appleModule || !appleAvailable) return;

    setError(null);
    setLoading(true);

    try {
      await signInWithApple();
    } catch (e) {
      if (isAppleAuthCanceled(e)) {
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

        {hasSocialAuth ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {appleModule && appleAvailable ? (
              <>
                <View
                  pointerEvents={loading ? 'none' : 'auto'}
                  style={[styles.appleButtonWrap, loading && styles.buttonDisabled]}
                >
                  <appleModule.AppleAuthenticationButton
                    buttonStyle={appleModule.AppleAuthenticationButtonStyle.BLACK}
                    buttonType={appleModule.AppleAuthenticationButtonType.SIGN_IN}
                    cornerRadius={12}
                    onPress={() => void handleAppleLogin()}
                    style={styles.appleButton}
                  />
                </View>
                {googleAvailable ? <View style={styles.altSpacing} /> : null}
              </>
            ) : null}

            {googleAvailable ? (
              nativeGoogleEnabled && googleModule ? (
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
              )
            ) : null}
          </>
        ) : null}

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
  appleButtonWrap: {
    alignSelf: 'stretch',
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
