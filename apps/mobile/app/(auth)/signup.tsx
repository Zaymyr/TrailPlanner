import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { beginAnonymousEmailUpgrade } from '../../lib/accountConversion';
import { isAnonymousSession } from '../../lib/appSession';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { ensureTrialStatusForSession } from '../../lib/trial';

const passwordHasRequiredShape = (value: string) =>
  value.length >= 8 && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value) && /\d/.test(value);

export default function SignupScreen() {
  const { t } = useI18n();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const isGuestSession = isAnonymousSession(session);
  const { googleModule, nativeGoogleEnabled, handleGoogleLogin } = useGoogleAuth({
    noOauthUrlMessage: t.auth.noOauthUrl,
    session,
  });

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

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Pace Yourself</Text>
          <Text style={styles.successIcon}>OK</Text>
          <Text style={styles.successTitle}>
            {isGuestSession ? t.auth.guestAccountCreated : t.auth.accountCreated}
          </Text>
          <Text style={styles.successText}>
            {isGuestSession ? t.auth.guestVerifyEmail : t.auth.verifyEmail}
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>{t.auth.loginLink}</Text>
            </TouchableOpacity>
          </Link>
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
        <Text style={styles.title}>Pace Yourself</Text>
        <Text style={styles.subtitle}>
          {isGuestSession ? t.auth.guestSignUpSubtitle : t.auth.signUpSubtitle}
        </Text>

        {isGuestSession ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{t.auth.guestModeTitle}</Text>
            <Text style={styles.infoBody}>{t.auth.guestSignUpHint}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder={t.auth.firstNamePlaceholder}
          placeholderTextColor={Colors.textMuted}
          value={fullName}
          onChangeText={setFullName}
          textContentType="givenName"
          autoCapitalize="words"
        />

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
          placeholder={t.auth.passwordMin}
          placeholderTextColor={Colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? t.auth.signingUp : t.auth.signUpCta}</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {nativeGoogleEnabled && googleModule ? (
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
          <TouchableOpacity
            style={[styles.googleButton, loading && styles.buttonDisabled]}
            onPress={handleGoogleSignup}
            disabled={loading}
          >
            <Text style={styles.googleButtonText}>{t.auth.googleSignUpCta}</Text>
          </TouchableOpacity>
        )}

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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
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
    color: Colors.textPrimary,
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
    marginBottom: 16,
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
    marginBottom: 32,
    lineHeight: 22,
  },
});
