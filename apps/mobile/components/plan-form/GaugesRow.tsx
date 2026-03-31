import { View } from 'react-native';
import { GaugeArc, type GaugeMetric } from './GaugeArc';
import { styles } from './styles';

type Props = {
  metrics: GaugeMetric[];
  compact?: boolean;
  formatGaugeValue: (metric: GaugeMetric, value: number) => string;
  getGaugeColor: (key: GaugeMetric['key'], ratio: number) => string;
};

export function GaugesRow({ metrics, compact = false, formatGaugeValue, getGaugeColor }: Props) {
  return (
    <View style={compact ? styles.gaugesRowCompact : styles.gaugesRow}>
      {metrics.map((metric) => (
        <GaugeArc
          key={metric.key}
          metric={metric}
          formatGaugeValue={formatGaugeValue}
          getGaugeColor={getGaugeColor}
          compact={compact}
        />
      ))}
    </View>
  );
}
