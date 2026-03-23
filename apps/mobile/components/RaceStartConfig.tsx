import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';

export type AlertConfirmMode =
  | 'manual'
  | 'auto_5'
  | 'auto_10'
  | 'fire_forget';

export type RaceConfig = {
  timingMode: 'time' | 'gps' | 'auto';
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
    label: '✋ Manuel',
    description: "Je confirme depuis l'app après chaque prise",
  },
  {
    value: 'auto_5',
    label: '⏱ Auto-confirm 5 min',
    description: "Idéal pour Garmin — confirmé automatiquement si pas d'action",
    tag: 'Garmin',
  },
  {
    value: 'auto_10',
    label: '⏱ Auto-confirm 10 min',
    description: 'Confirmé automatiquement après 10 min sans action',
  },
  {
    value: 'fire_forget',
    label: '🔕 Sans suivi',
    description: 'Notifications envoyées, aucune confirmation requise',
  },
];

const TIMING_MODES: Array<{ value: 'time' | 'gps' | 'auto'; label: string }> = [
  { value: 'time', label: '⏱ Temps' },
  { value: 'auto', label: '🔀 Auto' },
  { value: 'gps', label: '📍 GPS' },
];

export default function RaceStartConfig({ visible, raceName, onStart, onCancel }: Props) {
  const [timingMode, setTimingMode] = useState<'time' | 'gps' | 'auto'>('auto');
  const [confirmMode, setConfirmMode] = useState<AlertConfirmMode>('manual');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>▶ Démarrer</Text>
            <Text style={styles.headerSubtitle} numberOfLines={2}>
              {raceName}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
            {/* Timing mode */}
            <Text style={styles.sectionLabel}>MODE DE TIMING</Text>
            <View style={styles.pillRow}>
              {TIMING_MODES.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.pill, timingMode === m.value && styles.pillActive]}
                  onPress={() => setTimingMode(m.value)}
                >
                  <Text style={[styles.pillText, timingMode === m.value && styles.pillTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Confirm modes */}
            <Text style={styles.sectionLabel}>VALIDATION DES PRISES</Text>
            {CONFIRM_MODES.map((cm) => (
              <TouchableOpacity
                key={cm.value}
                style={[styles.modeCard, confirmMode === cm.value && styles.modeCardActive]}
                onPress={() => setConfirmMode(cm.value)}
                activeOpacity={0.8}
              >
                <View style={styles.modeCardHeader}>
                  <Text style={styles.modeCardLabel}>{cm.label}</Text>
                  {cm.tag && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{cm.tag}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modeCardDesc}>{cm.description}</Text>
              </TouchableOpacity>
            ))}

            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => onStart({ timingMode, confirmMode })}
            >
              <Text style={styles.startBtnText}>▶ Démarrer</Text>
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
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: '#14532d',
  },
  pillText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
  pillTextActive: {
    color: '#22c55e',
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
