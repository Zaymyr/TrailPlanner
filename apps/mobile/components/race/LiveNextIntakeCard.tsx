import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/colors';
import type { ActiveAlert } from '../../lib/raceLiveSession';

type Props = {
  alert: ActiveAlert | null;
  startedAt: Date;
  onConfirm: () => void;
  onSnooze: (minutes: number) => void;
  onSkip: () => void;
};

function formatTriggerTime(startedAt: Date, triggerMinutes: number) {
  return new Date(startedAt.getTime() + triggerMinutes * 60_000).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LiveNextIntakeCard({ alert, startedAt, onConfirm, onSnooze, onSkip }: Props) {
  if (!alert) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Toutes les prises sont faites</Text>
        <Text style={styles.emptyText}>Le suivi live n'a plus de rappel en attente.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Prochaine prise</Text>
          <Text style={styles.title}>{alert.title}</Text>
        </View>
        <Text style={styles.time}>{formatTriggerTime(startedAt, alert.triggerMinutes)}</Text>
      </View>

      <Text style={styles.detail}>{alert.payload.detail}</Text>
      <Text style={styles.sectionLabel}>
        {alert.payload.fromName} {'->'} {alert.payload.toName}
      </Text>

      <View style={styles.chips}>
        {alert.payload.carbsGrams > 0 ? <Text style={styles.chip}>{alert.payload.carbsGrams} g glucides</Text> : null}
        {alert.payload.sodiumMg > 0 ? <Text style={styles.chip}>{alert.payload.sodiumMg} mg sodium</Text> : null}
        {alert.payload.waterMl > 0 ? <Text style={styles.chip}>{alert.payload.waterMl} ml eau</Text> : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryAction} onPress={onConfirm}>
          <Text style={styles.primaryActionText}>Fait</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => onSnooze(5)}>
          <Text style={styles.secondaryActionText}>+5 min</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => onSnooze(10)}>
          <Text style={styles.secondaryActionText}>+10 min</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostAction} onPress={onSkip}>
          <Text style={styles.ghostActionText}>Passer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 12,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  kicker: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    maxWidth: 220,
  },
  time: {
    color: Colors.brandPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  detail: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryAction: {
    flexGrow: 1,
    backgroundColor: Colors.brandPrimary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 96,
  },
  primaryActionText: {
    color: Colors.textOnBrand,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryAction: {
    backgroundColor: Colors.brandSurface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  ghostAction: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  ghostActionText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
});
