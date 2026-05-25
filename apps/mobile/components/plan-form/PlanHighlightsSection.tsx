import React from 'react';
import { View } from 'react-native';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';
import { styles } from './styles';

type Props = {
  totalDurationLabel: string;
  paceLabel: string;
  intermediateCount: number;
};

export const PlanHighlightsSection = React.memo(function PlanHighlightsSection({
  totalDurationLabel,
  paceLabel,
  intermediateCount,
}: Props) {
  return (
    <View style={styles.planSummaryCompact}>
      <View style={styles.planSummaryMetricsRow}>
        <View style={[styles.planSummaryMetric, styles.planSummaryMetricAccent]}>
          <DataText tone="brand" size="2xl" weight="bold" style={styles.planSummaryMetricValue}>
            {totalDurationLabel}
          </DataText>
          <Text style={styles.planSummaryMetricLabelAccent}>Temps estimé</Text>
        </View>

        <View style={[styles.planSummaryMetric, styles.planSummaryMetricAccent]}>
          <View style={styles.planSummaryValueRow}>
            <DataText tone="brand" size="2xl" weight="bold" style={styles.planSummaryMetricValue}>
              {paceLabel}
            </DataText>
            <Text style={styles.planSummaryUnit}>min/km</Text>
          </View>
          <Text style={styles.planSummaryMetricLabelAccent}>Allure moyenne</Text>
        </View>
      </View>
      <Text style={styles.planSummarySecondaryMeta}>{intermediateCount} ravitos planifiés</Text>
    </View>
  );
});
