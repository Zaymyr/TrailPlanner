import { View, Text, StyleSheet } from 'react-native';

type Props = {
  label: string;
  icon: string;
  consumed: number;
  target: number;
  unit: string;
  lastHourConsumed: number;
  lastHourTarget: number;
};

export function NutritionGauge({ label, icon, consumed, target, unit, lastHourConsumed, lastHourTarget }: Props) {
  const globalPct = Math.min(consumed / Math.max(target, 1), 1);
  const hourPct = Math.min(lastHourConsumed / Math.max(lastHourTarget, 1), 1);

  const getColor = (pct: number) => {
    if (pct >= 0.8) return '#22c55e';
    if (pct >= 0.5) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{Math.round(consumed)}<Text style={styles.unit}>{unit}</Text></Text>
      </View>

      {/* Jauge depuis le départ */}
      <View style={styles.gaugeRow}>
        <Text style={styles.gaugeLabel}>Depuis départ</Text>
        <View style={styles.gaugeTrack}>
          <View style={[styles.gaugeFill, {
            width: `${globalPct * 100}%`,
            backgroundColor: getColor(globalPct)
          }]} />
        </View>
        <Text style={[styles.gaugeTarget, { color: getColor(globalPct) }]}>
          {Math.round(target)}{unit}
        </Text>
      </View>

      {/* Jauge dernière heure */}
      <View style={styles.gaugeRow}>
        <Text style={styles.gaugeLabel}>Dernière heure</Text>
        <View style={styles.gaugeTrack}>
          <View style={[styles.gaugeFill, {
            width: `${hourPct * 100}%`,
            backgroundColor: getColor(hourPct)
          }]} />
        </View>
        <Text style={[styles.gaugeTarget, { color: getColor(hourPct) }]}>
          {Math.round(lastHourTarget)}{unit}/h
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  icon: { fontSize: 18, marginRight: 6 },
  label: { color: '#f1f5f9', fontWeight: '600', flex: 1 },
  value: { color: '#f1f5f9', fontWeight: '700', fontSize: 18 },
  unit: { color: '#94a3b8', fontSize: 12, fontWeight: '400' },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  gaugeLabel: { color: '#64748b', fontSize: 11, width: 90 },
  gaugeTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 4,
  },
  gaugeTarget: { fontSize: 11, width: 60, textAlign: 'right' },
});
