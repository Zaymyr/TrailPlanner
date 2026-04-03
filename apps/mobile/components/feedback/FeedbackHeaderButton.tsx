import { useMemo, useState } from 'react';
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

type FeedbackKind = 'bug' | 'feedback';

type FeedbackHeaderButtonProps = {
  contextLabel?: string;
  leading?: React.ReactNode;
};

export function FeedbackHeaderButton({ contextLabel, leading }: FeedbackHeaderButtonProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [subject, setSubject] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitLabel = kind === 'bug' ? t.feedback.sendBug : t.feedback.sendFeedback;
  const metadata = useMemo(() => {
    const lines = [`${t.feedback.sourceLabel}: mobile`];
    if (contextLabel) {
      lines.push(`${t.feedback.screenLabel}: ${contextLabel}`);
    }
    return lines.join('\n');
  }, [contextLabel, t.feedback.screenLabel, t.feedback.sourceLabel]);

  const handleOpen = () => setVisible(true);
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
    const { error } = await supabase.from('app_feedback').insert({
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
    setKind('bug');
    Alert.alert(t.feedback.successTitle, kind === 'bug' ? t.feedback.bugSent : t.feedback.feedbackSent);
  };

  return (
    <>
      <View style={styles.headerActions}>
        {leading}
        <TouchableOpacity
          accessibilityLabel={t.feedback.triggerLabel}
          onPress={handleOpen}
          style={styles.iconButton}
        >
          <Ionicons name="bug-outline" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

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

            <Text style={styles.label}>{t.feedback.subjectLabel}</Text>
            <TextInput
              editable={!submitting}
              onChangeText={setSubject}
              placeholder={t.feedback.subjectPlaceholder}
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              value={subject}
            />

            <Text style={styles.label}>{t.feedback.detailLabel}</Text>
            <TextInput
              editable={!submitting}
              multiline
              numberOfLines={6}
              onChangeText={setDetail}
              placeholder={t.feedback.detailPlaceholder}
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, styles.textarea]}
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
  textarea: {
    minHeight: 132,
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
