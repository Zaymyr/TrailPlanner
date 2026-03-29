import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ActiveAlert } from '../lib/raceAlertService';
import { Colors } from '../constants/colors';

type Props = {
  alert: ActiveAlert | null;
  departureTime: Date;
  onConfirm: () => void;
  onSnooze: (minutes: number) => void;
  onSkip: () => void;
};

export function NextIntakeCard({ alert, departureTime, onConfirm, onSnooze, onSkip }: Props) {
  if (!alert) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>✅ Toutes les prises sont faites</Text>
      </View>
    );
  }

  const triggerTime = alert.triggerMinutes !== undefined
    ? new Date(departureTime.getTime() + alert.triggerMinutes * 60 * 1000)
        .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const isSnoozed = alert.status === 'snoozed';
  const products = alert.payload?.products ?? [];

  return (
    <View style={[styles.card, isSnoozed && styles.cardSnoozed]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.timeLabel}>⏰ {triggerTime}</Text>
        {isSnoozed && <Text style={styles.snoozedBadge}>😴 Snoozé</Text>}
      </View>

      <Text style={styles.title}>{alert.title}</Text>

      {/* Nutrition details */}
      <View style={styles.nutritionRow}>
        {alert.payload?.carbsGrams > 0 && (
          <View style={styles.nutriBadge}>
            <Text style={styles.nutriText}>🍬 {alert.payload.carbsGrams}g</Text>
          </View>
        )}
        {alert.payload?.waterMl > 0 && (
          <View style={styles.nutriBadge}>
            <Text style={styles.nutriText}>💧 {alert.payload.waterMl}ml</Text>
          </View>
        )}
        {alert.payload?.sodiumMg > 0 && (
          <View style={styles.nutriBadge}>
            <Text style={styles.nutriText}>🧂 {alert.payload.sodiumMg}mg</Text>
          </View>
        )}
      </View>

      {/* Products */}
      {products.length > 0 && (
        <View style={styles.productsSection}>
          {products.map((p: any, i: number) => (
            <View key={i} style={styles.productRow}>
              <Text style={styles.productQty}>{p.quantity}x</Text>
              <Text style={styles.productName}>{p.name}</Text>
              <Text style={styles.productDetail}>
                {p.carbsGrams > 0 ? `${p.carbsGrams}g glucides` : ''}
                {p.carbsGrams > 0 && p.sodiumMg > 0 ? ' · ' : ''}
                {p.sodiumMg > 0 ? `${p.sodiumMg}mg sodium` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
          <Text style={styles.confirmText}>✅ Fait</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.snoozeBtn} onPress={() => onSnooze(5)}>
          <Text style={styles.snoozeText}>😴 +5min</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.snoozeBtn} onPress={() => onSnooze(10)}>
          <Text style={styles.snoozeText}>😴 +10min</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>⏭</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: { color: Colors.brandPrimary, fontWeight: '600' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: Colors.brandPrimary,
  },
  cardSnoozed: { borderLeftColor: '#6366f1' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  timeLabel: { color: Colors.textSecondary, fontSize: 13 },
  snoozedBadge: { color: '#6366f1', fontSize: 12 },
  title: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15, marginBottom: 8 },
  nutritionRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  nutriBadge: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nutriText: { color: Colors.textPrimary, fontSize: 13 },
  productsSection: { marginBottom: 10 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  productQty: { color: Colors.brandPrimary, fontWeight: '700', fontSize: 14, width: 24 },
  productName: { color: Colors.textPrimary, fontSize: 14, flex: 1 },
  productDetail: { color: Colors.textMuted, fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  confirmBtn: {
    flex: 2,
    backgroundColor: Colors.brandSurface,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.brandPrimary,
  },
  confirmText: { color: Colors.brandPrimary, fontWeight: '700' },
  snoozeBtn: { flex: 1, backgroundColor: '#1e1b4b', borderRadius: 8, padding: 10, alignItems: 'center' },
  snoozeText: { color: '#818cf8', fontSize: 12 },
  skipBtn: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipText: { color: Colors.textMuted },
});
