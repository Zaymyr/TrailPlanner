import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

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
  const stations = summary.checkpoints.filter((point) => !point.isStart && !point.isFinish);
  const crewCount = stations.filter((point) => point.assistanceState === 'available').length;
  const format = (value: number, digits = 0) => value.toLocaleString(locale, { maximumFractionDigits: digits });
  const hours = Math.max(0, summary.movingDurationMin) / 60;
  const averagePace = formatAveragePace(summary.totalDurationMin, summary.distanceKm);
  const stats = [
    { label: fr ? 'Temps total estimé' : 'Estimated total time', value: formatDuration(summary.totalDurationMin) },
    { label: fr ? 'Allure moyenne' : 'Average pace', value: averagePace === '—' ? averagePace : `${averagePace}/km` },
    { label: 'Distance', value: `${format(summary.distanceKm, 1)} km` },
    { label: fr ? 'Dénivelé positif' : 'Elevation gain', value: `${format(summary.elevationGainM)} m` },
    { label: fr ? 'Ravitos' : 'Aid stations', value: format(stations.length) },
    { label: fr ? 'Points avec assistance' : 'Crew access points', value: format(crewCount) },
    { label: fr ? 'Temps en mouvement' : 'Moving time', value: formatDuration(summary.movingDurationMin) },
    { label: fr ? 'Pauses prévues' : 'Planned stops', value: formatDuration(summary.totalPauseMinutes) },
  ];
  const contents = [
    { icon: 'time-outline' as const, title: fr ? 'Tes temps de passage' : 'Your checkpoint times',
      detail: fr ? 'Chaque ravito, tes pauses et ton arrivée dans une feuille de route.' : 'Every aid station, your stops and your finish in one race schedule.' },
    { icon: 'nutrition-outline' as const, title: fr ? 'Ta préparation nutrition' : 'Your nutrition preparation',
      detail: fr ? 'Les produits et quantités à emporter, répartis ravito par ravito.' : 'Products and carry quantities, organized for each aid station.' },
    { icon: 'people-outline' as const, title: fr ? 'Le briefing de ton assistance' : 'Your crew briefing',
      detail: crewCount > 0
        ? (fr ? `${crewCount} ${crewCount > 1 ? "points accessibles" : "point accessible"}, avec les quantités et consignes pour tes proches.` : `${crewCount} accessible ${crewCount > 1 ? "points" : "point"}, with quantities and instructions for your crew.`)
        : (fr ? 'Anticipe les zones sans assistance et ce que tu dois porter.' : 'Prepare for sections without crew access and what you need to carry.') },
    { icon: 'share-social-outline' as const, title: fr ? 'Ton plan à partager' : 'Your shareable plan',
      detail: fr ? 'Une synthèse pour ton équipe, actualisée depuis ton plan.' : 'A crew summary kept up to date from your plan.' },
  ];
  return <>
    <Heading variant="h2">{fr ? 'Ta course en un coup d’œil' : 'Your race at a glance'}</Heading>
    <View style={styles.statsGrid}>
      {stats.map((stat) => <View key={stat.label} style={styles.statCard}>
        <Text size="xs" tone="secondary">{stat.label}</Text>
        <DataText size="lg" tone="brand" weight="bold" numberOfLines={1} adjustsFontSizeToFit>{stat.value}</DataText>
      </View>)}
    </View>
    <View style={styles.card}>
      <Heading variant="h3">{fr ? 'Tes repères nutritionnels' : 'Your nutrition targets'}</Heading>
      <View style={styles.needsRow}>
        <View style={styles.needCell}>
          <DataText size="xl" tone="brand" weight="bold">{format(Math.round(hours * summary.targetCarbsPerHour))} g</DataText>
          <Text size="xs" tone="secondary">{fr ? 'Glucides estimés' : 'Estimated carbs'}</Text>
        </View>
        <View style={styles.needCell}>
          <DataText size="xl" tone="brand" weight="bold">{format(hours * summary.targetWaterPerHour / 1000, 1)} L</DataText>
          <Text size="xs" tone="secondary">{fr ? 'Eau estimée' : 'Estimated water'}</Text>
        </View>
      </View>
      <Text size="sm">{summary.targetCarbsPerHour} g/h · {summary.targetWaterPerHour} ml/h</Text>
      <Text size="xs" tone="secondary">{fr ? 'Besoins estimés sur le temps en mouvement, avant le choix et la répartition de tes produits.' : 'Needs estimated from moving time, before choosing and distributing your products.'}</Text>
    </View>
    <Heading variant="h3">{fr ? 'Dans ton récap complet' : 'Inside your complete recap'}</Heading>
    {contents.map((item) => <Pressable
      key={item.title}
      accessibilityRole="button"
      accessibilityLabel={`${fr ? 'Débloquer' : 'Unlock'} : ${item.title}`}
      onPress={onUnlock}
      style={({ pressed }) => [styles.contentsCard, pressed && styles.contentsPressed]}
    >
      <View style={styles.contentsIcon}><Ionicons name={item.icon} size={22} color={Colors.brandPrimary} /></View>
      <View style={styles.contentsCopy}>
        <Text weight="bold">{item.title}</Text>
        <Text size="sm" tone="secondary">{item.detail}</Text>
      </View>
      <Ionicons name="lock-closed-outline" size={17} color={Colors.textSecondary} />
    </Pressable>)}
    <Button onPress={onUnlock}>{fr ? 'Débloquer mon plan' : 'Unlock my plan'}</Button>
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexBasis: '46%', flexGrow: 1, gap: 8, padding: 14, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  needsRow: { flexDirection: 'row', gap: 12 },
  needCell: { flex: 1, gap: 5 },
  contentsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  contentsIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  contentsCopy: { flex: 1, gap: 5 },
  contentsPressed: { opacity: 0.7 },
  card: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10 },
  lockedArea: { minHeight: 218, borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.surfaceSecondary, justifyContent: 'center' },
  blurredPreview: { ...StyleSheet.absoluteFillObject, padding: 14, justifyContent: 'space-around', opacity: 0.45 },
  placeholderRow: { gap: 10 },
  blurText: { color: 'transparent', textShadowColor: Colors.textSecondary, textShadowRadius: 7, textShadowOffset: { width: 0, height: 0 }, fontSize: 20 },
  placeholderBar: { height: 8, borderRadius: 10, backgroundColor: Colors.borderStrong, opacity: 0.45 },
  lockOverlay: { padding: 18, gap: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.80)' },
  centerText: { textAlign: 'center' },
});
