import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/colors';
import type { AlertConfirmMode } from '../../lib/raceLiveSession';

export type RaceStartConfig = {
  confirmMode: AlertConfirmMode;
};

type Props = {
  visible: boolean;
  raceName: string;
  onStart: (config: RaceStartConfig) => void;
  onCancel: () => void;
};

const CONFIRM_MODES: Array<{
  value: AlertConfirmMode;
  label: string;
  description: string;
  tag?: string;
}> = [
  {
    value: 'manual',
    label: 'Manuel',
    description: "Je confirme chaque prise depuis l'app.",
  },
  {
    value: 'auto_5',
    label: 'Auto 5 min',
    description: 'La prise est validee automatiquement apres 5 min sans action.',
    tag: 'Recommande',
  },
  {
    value: 'auto_10',
    label: 'Auto 10 min',
    description: 'La prise est validee automatiquement apres 10 min sans action.',
  },
  {
    value: 'fire_forget',
    label: 'Notif seule',
    description: 'Le rappel part, sans suivi de validation.',
  },
];

export function RaceStartSheet({ visible, raceName, onStart, onCancel }: Props) {
  const [confirmMode, setConfirmMode] = useState<AlertConfirmMode>('manual');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Demarrer le suivi live</Text>
            <Text style={styles.headerSubtitle} numberOfLines={2}>
              {raceName}
            </Text>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              Les notifications suivent la timeline nutrition definie dans les sections du plan.
            </Text>

            <Text style={styles.sectionLabel}>VALIDATION DES PRISES</Text>
            {CONFIRM_MODES.map((mode) => (
              <TouchableOpacity
                key={mode.value}
                activeOpacity={0.85}
                style={[styles.modeCard, confirmMode === mode.value && styles.modeCardActive]}
                onPress={() => setConfirmMode(mode.value)}
              >
                <View style={styles.modeHeader}>
                  <Text style={styles.modeTitle}>{mode.label}</Text>
                  {mode.tag ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{mode.tag}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.modeDescription}>{mode.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startButton} onPress={() => onStart({ confirmMode })}>
              <Text style={styles.startText}>Demarrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  scrollArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  modeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  modeCardActive: {
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modeTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  modeDescription: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  tag: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    color: Colors.textOnBrand,
    fontSize: 11,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  startButton: {
    flex: 1.6,
    backgroundColor: Colors.brandPrimary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  startText: {
    color: Colors.textOnBrand,
    fontSize: 15,
    fontWeight: '800',
  },
});
