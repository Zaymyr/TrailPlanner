import { useState } from 'react';
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

  async function handleSignup() {
    setError(null);

    if (!passwordHasRequiredShape(password)) {
      setError(t.auth.passwordTooShort);
      return;
    }

    setLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() || undefined },
      },
    });
    setLoading(false);

    if (signupError) {
      const lowered = signupError.message.toLowerCase();
      if (lowered.includes('already registered') || lowered.includes('already exists')) {
        setError(t.auth.emailInUse);
      } else if (lowered.includes('password')) {
        setError(t.auth.passwordTooShort);
      } else {
        setError(signupError.message);
      }
      return;
    }

    if (data.session) {
      await ensureTrialStatusForSession(data.session);
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Pace Yourself</Text>
          <Text style={styles.successIcon}>OK</Text>
          <Text style={styles.successTitle}>{t.auth.accountCreated}</Text>
          <Text style={styles.successText}>{t.auth.verifyEmail}</Text>
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
        <Text style={styles.subtitle}>{t.auth.signUpSubtitle}</Text>

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
