import React from 'react';
import { View } from 'react-native';
import { GaugeArc, type GaugeMetric } from './GaugeArc';
import { styles } from './styles';

type Props = {
  metrics: GaugeMetric[];
  compact?: boolean;
  formatGaugeValue: (metric: GaugeMetric, value: number) => string;
  getGaugeColor: (key: GaugeMetric['key'], ratio: number) => string;
  animateSignal?: number;
};

export const GaugesRow = React.memo(function GaugesRow({ metrics, compact = false, formatGaugeValue, getGaugeColor, animateSignal = 0 }: Props) {
  return (
    <View style={compact ? styles.gaugesRowCompact : styles.gaugesRow}>
      {metrics.map((metric) => (
        <GaugeArc
          key={metric.key}
          metric={metric}
          formatGaugeValue={formatGaugeValue}
          getGaugeColor={getGaugeColor}
          compact={compact}
          animateSignal={animateSignal}
        />
      ))}
    </View>
  );
}, (prev, next) => {
  if (
    prev.compact !== next.compact ||
    prev.animateSignal !== next.animateSignal ||
    prev.formatGaugeValue !== next.formatGaugeValue ||
    prev.getGaugeColor !== next.getGaugeColor ||
    prev.metrics.length !== next.metrics.length
  ) {
    return false;
  }

  return prev.metrics.every((metric, index) => {
    const nextMetric = next.metrics[index];
    return (
      metric.key === nextMetric.key &&
      metric.current === nextMetric.current &&
      metric.target === nextMetric.target &&
      metric.ratio === nextMetric.ratio &&
      metric.statusRatio === nextMetric.statusRatio
    );
  });
});
