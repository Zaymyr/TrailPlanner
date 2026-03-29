import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ActiveAlert } from '../lib/raceAlertService';

type AlertPayload = {
  carbsGrams?: number;
  waterMl?: number;
  sodiumMg?: number;
  products?: Array<{ name: string; quantity: number; carbsGrams: number; sodiumMg: number }>;
  [key: string]: unknown;
};

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
  const payload = alert.payload as AlertPayload;
  const products = payload.products ?? [];

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
        {(payload.carbsGrams ?? 0) > 0 && (
          <View style={styles.nutriBadge}>
            <Text style={styles.nutriText}>🍬 {payload.carbsGrams}g</Text>
          </View>
        )}
        {(payload.waterMl ?? 0) > 0 && (
          <View style={styles.nutriBadge}>
            <Text style={styles.nutriText}>💧 {payload.waterMl}ml</Text>
          </View>
        )}
        {(payload.sodiumMg ?? 0) > 0 && (
          <View style={styles.nutriBadge}>
            <Text style={styles.nutriText}>🧂 {payload.sodiumMg}mg</Text>
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
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyText: { color: '#22c55e', fontWeight: '600' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  cardSnoozed: { borderLeftColor: '#6366f1' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  timeLabel: { color: '#94a3b8', fontSize: 13 },
  snoozedBadge: { color: '#6366f1', fontSize: 12 },
  title: { color: '#f1f5f9', fontWeight: '700', fontSize: 15, marginBottom: 8 },
  nutritionRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  nutriBadge: { backgroundColor: '#0f172a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  nutriText: { color: '#f1f5f9', fontSize: 13 },
  productsSection: { marginBottom: 10 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  productQty: { color: '#22c55e', fontWeight: '700', fontSize: 14, width: 24 },
  productName: { color: '#f1f5f9', fontSize: 14, flex: 1 },
  productDetail: { color: '#64748b', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  confirmBtn: { flex: 2, backgroundColor: '#14532d', borderRadius: 8, padding: 10, alignItems: 'center' },
  confirmText: { color: '#22c55e', fontWeight: '700' },
  snoozeBtn: { flex: 1, backgroundColor: '#1e1b4b', borderRadius: 8, padding: 10, alignItems: 'center' },
  snoozeText: { color: '#818cf8', fontSize: 12 },
  skipBtn: { backgroundColor: '#1e293b', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  skipText: { color: '#475569' },
});
