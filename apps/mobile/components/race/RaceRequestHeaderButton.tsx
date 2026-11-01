import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Text } from '../themed/Text';
import { DatePickerField } from '../inputs/DatePickerField';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { parseRequestedDate } from '../../lib/raceRequestDate';
import { supabase, supabaseInitError } from '../../lib/supabase';

type RaceRequestHeaderButtonProps = {
  children?: (open: () => void) => ReactNode;
};

export function RaceRequestHeaderButton({ children }: RaceRequestHeaderButtonProps) {
  const { locale, t } = useI18n();
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
      {children ? (
        children(() => setVisible(true))
      ) : (
        <TouchableOpacity
          accessibilityLabel={t.raceRequests.triggerLabel}
          accessibilityRole="button"
          onPress={() => setVisible(true)}
          style={styles.iconButton}
        >
          <Ionicons name="paper-plane-outline" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}

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
          <View accessibilityViewIsModal style={styles.card}>
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
            <DatePickerField
              accessibilityLabel={t.raceRequests.dateLabel}
              locale={locale}
              onChange={(date) => setRaceDate(formatIsoDate(date))}
              placeholder={t.raceRequests.datePlaceholder}
              unavailableMessage={t.common.datePickerUnavailable}
              value={parseIsoDate(raceDate)}
            />
            {raceDate ? (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => setRaceDate('')}
                style={styles.clearDateButton}
              >
                <Text style={styles.clearDateText}>{t.catalog.clearDate}</Text>
              </TouchableOpacity>
            ) : null}

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

function parseIsoDate(value: string): Date | null {
  const parsed = parseRequestedDate(value);
  if (!parsed) return null;
  const [year, month, day] = parsed.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  clearDateButton: { alignSelf: 'flex-start', marginBottom: 14, marginTop: 6 },
  clearDateText: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700' },
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
