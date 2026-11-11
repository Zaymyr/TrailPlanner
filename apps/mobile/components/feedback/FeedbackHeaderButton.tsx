import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { Field } from '../themed/Field';
import { IconAction } from '../themed/IconAction';
import { Text } from '../themed/Text';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { supabase, supabaseInitError } from '../../lib/supabase';

export type FeedbackKind = 'bug' | 'feedback';

type FeedbackHeaderButtonProps = {
  children?: (open: () => void) => ReactNode;
  contextLabel?: string;
  /** Kind selected when the form opens (bug by default). */
  initialKind?: FeedbackKind;
  leading?: ReactNode;
};

export function FeedbackHeaderButton({ children, contextLabel, initialKind = 'bug', leading }: FeedbackHeaderButtonProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>(initialKind);
  const [subject, setSubject] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitLabel = kind === 'bug' ? t.feedback.sendBug : t.feedback.sendFeedback;
  const appVersion = Constants.expoConfig?.version?.trim() || null;
  const metadata = useMemo(() => {
    const lines = [`${t.feedback.sourceLabel}: mobile`];
    if (contextLabel) {
      lines.push(`${t.feedback.screenLabel}: ${contextLabel}`);
    }
    if (appVersion) {
      lines.push(`Version: ${appVersion}`);
    }
    return lines.join('\n');
  }, [appVersion, contextLabel, t.feedback.screenLabel, t.feedback.sourceLabel]);

  const handleOpen = () => {
    setKind(initialKind);
    setVisible(true);
  };
  const handleClose = () => {
    if (submitting) return;
    setVisible(false);
  };

  const handleSubmit = async () => {
    const nextSubject = subject.trim();
    const nextDetail = detail.trim();

    if (!nextSubject || !nextDetail) {
      Alert.alert(t.common.error, t.feedback.missingFields);
      return;
    }

    if (!supabase) {
      Alert.alert(t.common.error, supabaseInitError ?? t.feedback.sendFailed);
      return;
    }

    setSubmitting(true);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      setSubmitting(false);
      Alert.alert(t.common.error, userError?.message || t.feedback.sendFailed);
      return;
    }

    const { error } = await supabase.from('app_feedback').insert({
      user_id: user.id,
      kind,
      source: 'mobile',
      screen: contextLabel?.trim() || null,
      app_version: appVersion,
      subject: `[${kind}] ${nextSubject}`,
      detail: `${nextDetail}\n\n---\n${metadata}`,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert(t.common.error, error.message || t.feedback.sendFailed);
      return;
    }

    setVisible(false);
    setSubject('');
    setDetail('');
    setKind(initialKind);
    Alert.alert(t.feedback.successTitle, kind === 'bug' ? t.feedback.bugSent : t.feedback.feedbackSent);
  };

  return (
    <>
      {children ? (
        children(handleOpen)
      ) : (
        <View style={styles.headerActions}>
          {leading}
          <IconAction
            accessibilityLabel={t.feedback.triggerLabel}
            icon={<Ionicons name="bug-outline" size={20} color={Colors.textPrimary} />}
            onPress={handleOpen}
          />
        </View>
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
            <Text style={styles.title}>{t.feedback.modalTitle}</Text>
            <Text style={styles.subtitle}>{t.feedback.modalSubtitle}</Text>

            <View style={styles.switchRow}>
              <TouchableOpacity
                onPress={() => setKind('bug')}
                style={[styles.switchChip, kind === 'bug' && styles.switchChipActive]}
              >
                <Text style={[styles.switchChipText, kind === 'bug' && styles.switchChipTextActive]}>
                  {t.feedback.bugOption}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setKind('feedback')}
                style={[styles.switchChip, kind === 'feedback' && styles.switchChipActive]}
              >
                <Text style={[styles.switchChipText, kind === 'feedback' && styles.switchChipTextActive]}>
                  {t.feedback.feedbackOption}
                </Text>
              </TouchableOpacity>
            </View>

            <Field
              containerStyle={styles.field}
              editable={!submitting}
              label={t.feedback.subjectLabel}
              onChangeText={setSubject}
              placeholder={t.feedback.subjectPlaceholder}
              value={subject}
            />

            <Field
              containerStyle={styles.field}
              editable={!submitting}
              label={t.feedback.detailLabel}
              multiline
              numberOfLines={6}
              onChangeText={setDetail}
              placeholder={t.feedback.detailPlaceholder}
              style={styles.textarea}
              textAlignVertical="top"
              value={detail}
            />

            <TouchableOpacity
              disabled={submitting}
              onPress={handleSubmit}
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.textOnBrand} />
              ) : (
                <Text style={styles.primaryButtonText}>{submitLabel}</Text>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  switchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  switchChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 11,
    alignItems: 'center',
  },
  switchChipActive: {
    backgroundColor: Colors.brandSurface,
    borderColor: Colors.brandBorder,
  },
  switchChipText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  switchChipTextActive: {
    color: Colors.brandPrimary,
  },
  field: {
    marginBottom: 14,
  },
  textarea: {
    minHeight: 132,
    paddingTop: 12,
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
