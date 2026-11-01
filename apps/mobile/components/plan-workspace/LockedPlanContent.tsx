import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { formatDuration, type PlanSummary } from '../../lib/planSummary';
import { formatAveragePace, type PlanWorkspaceTab } from '../../lib/planWorkspace';
import { Button } from '../themed/Button';
import { DataText } from '../themed/DataText';
import { Heading } from '../themed/Heading';
import { Text } from '../themed/Text';

type Props = {
  summary: PlanSummary;
  tab: PlanWorkspaceTab;
  contentTopInset: number;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onUnlock: () => void;
  simulation?: 'real' | 'free' | 'premium';
};

function LockedArea({ title, description, action, onUnlock }: {
  title: string; description: string; action: string; onUnlock: () => void;
}) {
  return (
    <View style={styles.lockedArea}>
      {/* Decorative placeholders only: paid values and controls are never mounted. */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.blurredPreview}>
        {[0, 1, 2].map((row) => <View key={row} style={styles.placeholderRow}>
          <Text style={styles.blurText}>▬▬▬▬▬▬   ▬▬▬   ▬▬▬▬</Text>
          <View style={[styles.placeholderBar, { width: `${72 - row * 12}%` }]} />
        </View>)}
      </View>
      <View style={styles.lockOverlay}>
        <Ionicons name="lock-closed-outline" size={20} color={Colors.brandPrimary} />
        <Text weight="bold" style={styles.centerText}>{title}</Text>
        <Text tone="secondary" size="sm" style={styles.centerText}>{description}</Text>
        <Button onPress={onUnlock}>{action}</Button>
      </View>
    </View>
  );
}

function RecapPreview({ summary, locale, onUnlock }: {
  summary: PlanSummary; locale: string; onUnlock: () => void;
}) {
  const fr = locale === 'fr';
  const averagePace = formatAveragePace(summary.totalDurationMin, summary.distanceKm);
  const stats = [
    { label: fr ? 'Temps estimé' : 'Estimated time', value: formatDuration(summary.totalDurationMin) },
    { label: fr ? 'Allure moyenne' : 'Average pace', value: averagePace === '—' ? averagePace : `${averagePace}/km` },
  ];
  const passagePreview = summary.checkpoints.slice(0, 2);
  const remainingPassages = Math.max(0, summary.checkpoints.length - passagePreview.length);
  return <>
    <View style={styles.card}>
      <Heading variant="h3">{fr ? 'Ton récap en bref' : 'Your recap at a glance'}</Heading>
      <View style={styles.statsGrid}>
        {stats.map((stat) => <View key={stat.label} style={styles.statCell}>
          <Text size="xs" tone="secondary">{stat.label}</Text>
          <DataText size="xl" tone="brand" weight="bold" numberOfLines={1} adjustsFontSizeToFit>{stat.value}</DataText>
        </View>)}
      </View>
      <Text size="sm" tone="secondary">{fr ? 'Ravitos, pauses, besoins nutritionnels… découvre toute ta stratégie de course.' : 'Aid stations, stops, nutrition needs… discover your complete race strategy.'}</Text>
      <Button onPress={onUnlock}>{fr ? 'Voir le reste des statistiques' : 'See the remaining statistics'}</Button>
    </View>
    <View style={[styles.card, styles.passageCard]}>
      <View style={styles.passageHeading}>
        <Ionicons name="time-outline" size={20} color={Colors.brandPrimary} />
        <Heading variant="h3">{fr ? 'Tes temps de passage' : 'Your checkpoint times'}</Heading>
      </View>
      <Text size="sm" tone="secondary">{fr ? 'Anticipe tes passages et ton arrivée.' : 'Prepare for your checkpoints and finish.'}</Text>
      <View style={styles.passageTable}>
        <View style={styles.passageRow}>
          <Text size="xs" tone="secondary" style={styles.passageName}>{fr ? 'Point de passage' : 'Checkpoint'}</Text>
          <Text size="xs" tone="secondary">{fr ? 'Temps écoulé' : 'Elapsed time'}</Text>
        </View>
        {passagePreview.map((point) => <View key={point.index} style={styles.passageRow}>
          <View style={styles.passageName}>
            <Text size="sm" weight="semibold" numberOfLines={1}>{point.name}</Text>
            <Text size="xs" tone="secondary">{point.distanceKm.toLocaleString(locale, { maximumFractionDigits: 1 })} km</Text>
          </View>
          {point.isStart ? <DataText size="sm">{formatDuration(0)}</DataText> : (
            <View accessibilityLabel={fr ? 'Temps de passage verrouillé' : 'Locked checkpoint time'} style={styles.hiddenPassage}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.timePlaceholder} />
              <Ionicons name="lock-closed-outline" size={15} color={Colors.textSecondary} />
            </View>
          )}
        </View>)}
      </View>
      {remainingPassages > 0 ? <Text size="xs" tone="secondary">{fr ? `+ ${remainingPassages} ${remainingPassages > 1 ? 'autres points de passage' : 'autre point de passage'} dans ton plan complet` : `+ ${remainingPassages} more ${remainingPassages > 1 ? 'checkpoints' : 'checkpoint'} in your complete plan`}</Text> : null}
      <Button variant="secondary" onPress={onUnlock}>{fr ? 'Voir les temps de passage' : 'See checkpoint times'}</Button>
    </View>
  </>;
}

export function LockedPlanContent({ summary, tab, contentTopInset, onScroll, onUnlock, simulation = 'real' }: Props) {
  const { locale } = useI18n();
  const fr = locale === 'fr';
  const action = fr ? 'Débloquer mon plan' : 'Unlock my plan';
  const lock = (kind: 'pace' | 'nutrition' | 'recap' | 'settings') => {
    const copy = {
      pace: [fr ? 'Adapte ton allure section par section' : 'Fine-tune your pace for every section', fr ? 'Prépare tes montées, tes descentes et tes temps de passage.' : 'Plan climbs, descents and checkpoint times.'],
      nutrition: [fr ? 'Construis ta nutrition ravito par ravito' : 'Build your nutrition at every aid station', fr ? 'Choisis tes produits, les quantités à emporter et tes pauses.' : 'Choose products, carry quantities and pauses.'],
      recap: [fr ? 'Tout ton plan de course, prêt à emporter' : 'Your complete race plan, ready to go', fr ? 'Retrouve tes temps de passage, ta liste de préparation et le plan de ton assistance.' : 'See checkpoint times, your packing list and your crew plan.'],
      settings: [fr ? 'Personnalise ta stratégie de course' : 'Personalize your race strategy', fr ? 'Ajuste tes objectifs et recalcule ta préparation complète.' : 'Adjust your targets and recalculate your complete preparation.'],
    }[kind];
    return <LockedArea title={copy[0]} description={copy[1]} action={action} onUnlock={onUnlock} />;
  };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: contentTopInset }]} onScroll={onScroll} scrollEventThrottle={16} testID="locked-plan-workspace">
      {simulation !== 'real' ? <Text size="sm">{fr ? 'Mode de test' : 'Test mode'} : {simulation}</Text> : null}
      {tab === 'settings' ? <View style={styles.card}>
        <Text weight="bold">{fr ? 'Tes objectifs actuels' : 'Your current targets'}</Text>
        <Text>{summary.targetCarbsPerHour} g/h · {summary.targetWaterPerHour} ml/h</Text>
        <Text>{fr ? 'Poche à eau' : 'Water bladder'} : {summary.waterBagLiters} L</Text>
        {lock('settings')}
      </View> : <RecapPreview summary={summary} locale={locale} onUnlock={onUnlock} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 120, gap: 16 },
  statsGrid: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
  statCell: { flex: 1, gap: 6 },
  passageCard: { marginTop: 12 },
  passageHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passageTable: { gap: 2 },
  passageRow: { minHeight: 42, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  passageName: { flex: 1, gap: 3 },
  hiddenPassage: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timePlaceholder: { width: 38, height: 7, borderRadius: 4, backgroundColor: Colors.borderStrong, opacity: 0.55 },
  card: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10 },
  lockedArea: { minHeight: 218, borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.surfaceSecondary, justifyContent: 'center' },
  blurredPreview: { ...StyleSheet.absoluteFillObject, padding: 14, justifyContent: 'space-around', opacity: 0.45 },
  placeholderRow: { gap: 10 },
  blurText: { color: 'transparent', textShadowColor: Colors.textSecondary, textShadowRadius: 7, textShadowOffset: { width: 0, height: 0 }, fontSize: 20 },
  placeholderBar: { height: 8, borderRadius: 10, backgroundColor: Colors.borderStrong, opacity: 0.45 },
  lockOverlay: { padding: 18, gap: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.80)' },
  centerText: { textAlign: 'center' },
});
