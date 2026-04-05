import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { supabase, supabaseInitError } from '../../lib/supabase';

function parseRequestedDate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const localMatch = /^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/.exec(trimmed);

  let year: string;
  let month: string;
  let day: string;

  if (isoMatch) {
    [, year, month, day] = isoMatch;
  } else if (localMatch) {
    [, day, month, year] = localMatch;
  } else {
    return null;
  }

  const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

export function RaceRequestHeaderButton() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [raceName, setRaceName] = useState('');
  const [location, setLocation] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setVisible(false);
  };

  const resetForm = () => {
    setRaceName('');
    setLocation('');
    setRaceDate('');
  };

  const handleSubmit = async () => {
    const nextRaceName = raceName.trim();
    const nextLocation = location.trim();
    const nextRaceDate = raceDate.trim();

    if (!nextRaceName || !nextLocation || !nextRaceDate) {
      Alert.alert(t.common.error, t.raceRequests.missingFields);
      return;
    }

    const requestedDate = parseRequestedDate(nextRaceDate);
    if (!requestedDate) {
      Alert.alert(t.common.error, t.raceRequests.invalidDate);
      return;
    }

    if (!supabase) {
      Alert.alert(t.common.error, supabaseInitError ?? t.raceRequests.sendFailed);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      Alert.alert(t.common.error, t.raceRequests.sessionExpired);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('race_requests').insert({
      user_id: user.id,
      race_name: nextRaceName,
      location: nextLocation,
      requested_date: requestedDate,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert(t.common.error, error.message || t.raceRequests.sendFailed);
      return;
    }

    handleClose();
    resetForm();
    Alert.alert(t.raceRequests.successTitle, t.raceRequests.successMessage);
  };

  return (
    <>
      <TouchableOpacity
        accessibilityLabel={t.raceRequests.triggerLabel}
        onPress={() => setVisible(true)}
        style={styles.iconButton}
      >
        <Ionicons name="paper-plane-outline" size={18} color={Colors.textPrimary} />
      </TouchableOpacity>

      <Modal
        animationType="fade"
        onRequestClose={handleClose}
        transparent
        visible={visible}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalWrapper}
        >
          <Pressable style={styles.overlay} onPress={handleClose} />
          <View style={styles.card}>
            <Text style={styles.title}>{t.raceRequests.modalTitle}</Text>
            <Text style={styles.subtitle}>{t.raceRequests.modalSubtitle}</Text>

            <Text style={styles.label}>{t.raceRequests.raceNameLabel}</Text>
            <TextInput
              editable={!submitting}
              onChangeText={setRaceName}
              placeholder={t.raceRequests.raceNamePlaceholder}
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              value={raceName}
            />

            <Text style={styles.label}>{t.raceRequests.locationLabel}</Text>
            <TextInput
              editable={!submitting}
              onChangeText={setLocation}
              placeholder={t.raceRequests.locationPlaceholder}
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              value={location}
            />

            <Text style={styles.label}>{t.raceRequests.dateLabel}</Text>
            <TextInput
              editable={!submitting}
              onChangeText={setRaceDate}
              placeholder={t.raceRequests.datePlaceholder}
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              value={raceDate}
            />
            <Text style={styles.hint}>{t.raceRequests.dateHint}</Text>

            <TouchableOpacity
              disabled={submitting}
              onPress={handleSubmit}
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.textOnBrand} />
              ) : (
                <Text style={styles.primaryButtonText}>{t.raceRequests.submit}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity disabled={submitting} onPress={handleClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 22,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: 15,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
    marginTop: -6,
  },
  primaryButton: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: Colors.textOnBrand,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 2,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
});
