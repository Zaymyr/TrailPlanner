import { StyleSheet, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';

import { Colors } from '../../constants/colors';
import type { LiveMetricState } from '../../lib/raceLivePlan';

type Props = {
  metric: LiveMetricState;
};

function clampRatio(ratio: number) {
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(ratio, 1.4));
}

function getMetricColor(metric: LiveMetricState) {
  if (metric.key === 'water') {
    if (metric.ratio >= 0.8) return Colors.success;
    if (metric.ratio >= 0.6) return Colors.warning;
    return Colors.danger;
  }

  if (metric.ratio >= 0.8 && metric.ratio <= 1.2) return Colors.success;
  if ((metric.ratio >= 0.6 && metric.ratio < 0.8) || (metric.ratio > 1.2 && metric.ratio <= 1.4)) return Colors.warning;
  return Colors.danger;
}

function formatValue(metric: LiveMetricState, value: number) {
  if (metric.key === 'water') return `${Math.round(value)} ml`;
  if (metric.key === 'sodium') return `${Math.round(value)} mg`;
  return `${Math.round(value)} g`;
}

export function LiveFuelGauge({ metric }: Props) {
  const color = getMetricColor(metric);
  const fillRatio = clampRatio(metric.ratio);
  const fillPercent = `${Math.min(fillRatio, 1) * 100}%` as DimensionValue;
  const overflowPercent = (fillRatio > 1 ? `${Math.min(fillRatio - 1, 0.4) * 100}%` : '0%') as DimensionValue;
  const levelPercent = Math.round(Math.max(metric.ratio, 0) * 100);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{metric.label}</Text>
        <Text style={[styles.percent, { color }]}>{levelPercent}%</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: fillPercent, backgroundColor: color }]} />
        {fillRatio > 1 ? (
          <View
            style={[
              styles.overflow,
              {
                width: overflowPercent,
                backgroundColor: color,
              },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Base {formatValue(metric, metric.targetPerHour)}</Text>
        <Text style={styles.metaText}>Ecoule {formatValue(metric, metric.depletion)}</Text>
        <Text style={styles.metaText}>Pris {formatValue(metric, metric.consumed)}</Text>
      </View>

      <Text style={styles.currentValue}>Niveau actuel: {formatValue(metric, metric.current)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  percent: {
    fontSize: 22,
    fontWeight: '800',
  },
  track: {
    position: 'relative',
    height: 14,
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
    marginBottom: 12,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  overflow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.35,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  currentValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
