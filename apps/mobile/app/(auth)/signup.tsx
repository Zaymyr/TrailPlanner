import { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Text } from '../../components/themed/Text';
import { ActionButton } from '../../components/themed/ActionButton';
import { Field } from '../../components/themed/Field';
import { TopoCard } from '../../components/themed/TopoCard';
import { Link, useRouter } from 'expo-router';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { beginAnonymousEmailUpgrade } from '../../lib/accountConversion';
import { isAnonymousSession } from '../../lib/appSession';
import { useAppleAuth } from '../../hooks/useAppleAuth';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { ensureTrialStatusForSession } from '../../lib/trial';

const passwordHasRequiredShape = (value: string) =>
  value.length >= 8 && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value) && /\d/.test(value);

export default function SignupScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const isGuestSession = isAnonymousSession(session);
  const {
    appleModule,
    appleAvailable,
    handleAppleLogin,
    isAppleAuthCanceled,
  } = useAppleAuth({ session });
  const { googleModule, nativeGoogleEnabled, googleAvailable, handleGoogleLogin } = useGoogleAuth({
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

  async function handleSignup() {
    setError(null);

    if (!passwordHasRequiredShape(password)) {
      setError(t.auth.passwordTooShort);
      return;
    }

    setLoading(true);
    const signupResult = isGuestSession
      ? await beginAnonymousEmailUpgrade({
          email,
          password,
          fullName,
        })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() || undefined },
          },
        });
    setLoading(false);

    if (signupResult.error) {
      const lowered = signupResult.error.message.toLowerCase();
      if (lowered.includes('already registered') || lowered.includes('already exists')) {
        setError(t.auth.emailInUse);
      } else if (lowered.includes('password')) {
        setError(t.auth.passwordTooShort);
      } else {
        setError(signupResult.error.message);
      }
      return;
    }

    if ('session' in signupResult.data && signupResult.data.session) {
      await ensureTrialStatusForSession(signupResult.data.session);
    }

    setSuccess(true);
  }

  async function handleGoogleSignup() {
    setError(null);
    setLoading(true);

    try {
      await handleGoogleLogin();
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

      console.error('Google signup error:', e);
      setError(t.auth.googleError);
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignup() {
    if (!appleModule || !appleAvailable) return;

    setError(null);
    setLoading(true);

    try {
      await handleAppleLogin();
    } catch (e) {
      if (isAppleAuthCanceled(e)) {
        setLoading(false);
        return;
      }

      console.error('Apple signup error:', e);
      setError(t.auth.appleError);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <TopoCard surface="brand" variant="featured" style={styles.successCard}>
            <Text style={styles.successIcon}>OK</Text>
            <Text style={styles.successTitle}>
              {isGuestSession ? t.auth.guestAccountCreated : t.auth.accountCreated}
            </Text>
            <Text style={styles.successText}>
              {isGuestSession ? t.auth.guestVerifyEmail : t.auth.verifyEmail}
            </Text>
            <ActionButton fullWidth size="lg" onPress={() => router.replace('/(auth)/login')}>
              {t.auth.loginLink}
            </ActionButton>
          </TopoCard>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <TopoCard surface="brand" variant="featured" style={styles.hero}>
          <Text style={styles.title}>Pace Yourself</Text>
          <Text style={styles.subtitle}>
            {isGuestSession ? t.auth.guestSignUpSubtitle : t.auth.signUpSubtitle}
          </Text>
        </TopoCard>

        {isGuestSession ? (
          <TopoCard surface="cream" style={styles.infoCard}>
            <Text style={styles.infoTitle}>{t.auth.guestModeTitle}</Text>
            <Text style={styles.infoBody}>{t.auth.guestSignUpHint}</Text>
          </TopoCard>
        ) : null}

        <Field
          accessibilityLabel={t.auth.firstNamePlaceholder}
          containerStyle={styles.field}
          placeholder={t.auth.firstNamePlaceholder}
          value={fullName}
          onChangeText={setFullName}
          textContentType="givenName"
          autoCapitalize="words"
        />

        <Field
          accessibilityLabel={t.auth.emailPlaceholder}
          containerStyle={styles.field}
          placeholder={t.auth.emailPlaceholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <Field
          accessibilityLabel={t.auth.passwordMin}
          containerStyle={styles.field}
          placeholder={t.auth.passwordMin}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <ActionButton
          fullWidth
          isLoading={loading}
          size="lg"
          onPress={handleSignup}
          disabled={loading}
        >
          {t.auth.signUpCta}
        </ActionButton>

        {hasSocialAuth ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t.auth.alternativeDivider}</Text>
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
                    buttonType={appleModule.AppleAuthenticationButtonType.SIGN_UP}
                    cornerRadius={12}
                    onPress={() => void handleAppleSignup()}
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
                    onPress={handleGoogleSignup}
                    size={googleModule.GoogleSigninButton.Size.Wide}
                    style={styles.googleNativeButton}
                  />
                </View>
              ) : (
                <ActionButton
                  fullWidth
                  variant="secondary"
                  style={loading && styles.buttonDisabled}
                  onPress={handleGoogleSignup}
                  disabled={loading}
                >
                  {t.auth.googleSignUpCta}
                </ActionButton>
              )
            ) : null}
          </>
        ) : null}

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>{t.auth.alreadyAccount} </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.loginLink}>{t.auth.loginLink}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 72,
    paddingBottom: 32,
  },
  hero: {
    marginBottom: 20,
    paddingVertical: 22,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.brandPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  infoCard: {
    marginBottom: 16,
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
  field: {
    marginBottom: 12,
  },
  error: {
    color: Colors.danger,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
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
  googleNativeButtonWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  googleNativeButton: {
    width: '100%',
    height: 52,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  loginLink: {
    color: Colors.brandPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  successIcon: {
    fontSize: 42,
    textAlign: 'center',
    marginBottom: 12,
    color: Colors.brandPrimary,
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  successCard: {
    marginTop: 48,
    paddingVertical: 24,
  },
});
