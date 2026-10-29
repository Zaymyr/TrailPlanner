import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import type { PlanSummary } from '../../lib/planSummary';
import { formatDuration } from '../../lib/planSummary';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';

export function RacebookPersonalPlanCard({
  summary,
  requiredGearCount,
  checkedRequiredGearCount,
  revisionPending,
  locale,
  onOpenPlan,
}: {
  summary: PlanSummary | null;
  requiredGearCount: number;
  checkedRequiredGearCount: number;
  revisionPending: boolean;
  locale: 'fr' | 'en';
  onOpenPlan: () => void;
}) {
  const copy = locale === 'fr' ? {
    title: 'Mon plan pour cette course',
    empty: 'Crée ton plan personnel à partir des informations officielles, puis affine allure, pauses et nutrition.',
    create: 'Créer mon plan',
    refine: 'Affiner mon plan',
    review: 'Revoir mon plan',
    revision: 'L’organisation a modifié des informations qui peuvent influencer ton plan. Tes choix personnels restent inchangés.',
    duration: 'Durée prévue',
    stations: 'Ravitos planifiés',
    gear: 'Matériel obligatoire',
  } : {
    title: 'My plan for this race',
    empty: 'Create your personal plan from the official information, then refine pace, stops and nutrition.',
    create: 'Create my plan',
    refine: 'Refine my plan',
    review: 'Review my plan',
    revision: 'The organizer changed information that may affect your plan. Your personal choices remain unchanged.',
    duration: 'Expected duration',
    stations: 'Planned aid stations',
    gear: 'Mandatory gear',
  };
  const plannedStations = summary?.checkpoints.filter((checkpoint) => !checkpoint.isStart && !checkpoint.isFinish).length ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons color={Colors.brandPrimary} name="clipboard-outline" size={20} />
        <Text style={styles.title}>{copy.title}</Text>
      </View>
      {revisionPending ? (
        <View style={styles.alert}>
          <Ionicons color={Colors.warning} name="alert-circle-outline" size={18} />
          <Text style={styles.alertText}>{copy.revision}</Text>
        </View>
      ) : null}
      {summary ? (
        <View style={styles.metrics}>
          <Metric label={copy.duration} value={formatDuration(summary.totalDurationMin)} />
          <Metric label={copy.stations} value={String(plannedStations)} />
          <Metric label={copy.gear} value={`${Math.min(checkedRequiredGearCount, requiredGearCount)}/${requiredGearCount}`} />
        </View>
      ) : <Text style={styles.body}>{copy.empty}</Text>}
      <Pressable accessibilityRole="button" onPress={onOpenPlan} style={styles.action}>
        <Text style={styles.actionText}>{summary ? (revisionPending ? copy.review : copy.refine) : copy.create}</Text>
        <Ionicons color={Colors.textOnBrand} name="arrow-forward" size={17} />
      </Pressable>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <DataText style={styles.metricValue}>{value}</DataText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 13, borderWidth: 1, borderColor: Colors.brandBorder, borderRadius: 20, padding: 16, backgroundColor: Colors.brandSurface },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, padding: 11, backgroundColor: Colors.warningSurface },
  alertText: { flex: 1, color: Colors.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, gap: 3, borderRadius: 13, padding: 10, backgroundColor: Colors.surface },
  metricLabel: { color: Colors.textSecondary, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  metricValue: { color: Colors.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 22, paddingHorizontal: 16, backgroundColor: Colors.brandPrimary },
  actionText: { color: Colors.textOnBrand, fontSize: 14, lineHeight: 18, fontWeight: '800' },
});
