import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type AlertConfirmMode = 'manual' | 'auto_5' | 'auto_10' | 'fire_forget';

export type RaceConfig = {
  timingMode: 'time';
  confirmMode: AlertConfirmMode;
};

type Props = {
  visible: boolean;
  raceName: string;
  onStart: (config: RaceConfig) => void;
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
    description: "Je confirme depuis l'app apres chaque prise.",
  },
  {
    value: 'auto_5',
    label: 'Auto-confirm 5 min',
    description: "Ideal pour Garmin - confirme automatiquement si pas d'action.",
    tag: 'Garmin',
  },
  {
    value: 'auto_10',
    label: 'Auto-confirm 10 min',
    description: 'Confirme automatiquement apres 10 min sans action.',
  },
  {
    value: 'fire_forget',
    label: 'Sans suivi',
    description: 'Notifications envoyees, aucune confirmation requise.',
  },
];

export default function RaceStartConfig({ visible, raceName, onStart, onCancel }: Props) {
  const [confirmMode, setConfirmMode] = useState<AlertConfirmMode>('manual');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Demarrer</Text>
            <Text style={styles.headerSubtitle} numberOfLines={2}>
              {raceName}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
            <Text style={styles.description}>
              Le suivi de course est maintenant entierement base sur la timeline horaire du plan.
            </Text>

            <Text style={styles.sectionLabel}>VALIDATION DES PRISES</Text>
            {CONFIRM_MODES.map((mode) => (
              <TouchableOpacity
                key={mode.value}
                activeOpacity={0.8}
                style={[styles.modeCard, confirmMode === mode.value && styles.modeCardActive]}
                onPress={() => setConfirmMode(mode.value)}
              >
                <View style={styles.modeCardHeader}>
                  <Text style={styles.modeCardLabel}>{mode.label}</Text>
                  {mode.tag ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{mode.tag}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.modeCardDesc}>{mode.description}</Text>
              </TouchableOpacity>
            ))}

            <View style={{ height: 8 }} />
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startBtn} onPress={() => onStart({ timingMode: 'time', confirmMode })}>
              <Text style={styles.startBtnText}>Demarrer</Text>
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 8,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  scrollArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  description: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  modeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeCardActive: {
    borderColor: '#22c55e',
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  modeCardLabel: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  modeCardDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  tag: {
    backgroundColor: '#14532d',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  startBtn: {
    flex: 2,
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
});
