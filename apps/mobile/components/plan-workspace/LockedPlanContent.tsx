import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import type { PlanSummary } from '../../lib/planSummary';
import type { PlanWorkspaceTab } from '../../lib/planWorkspace';
import { Button } from '../themed/Button';
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
      </View> : <View style={styles.card}>
        <Text weight="bold">{fr ? 'Tes besoins nutritionnels' : 'Your nutrition needs'}</Text>
        <Text>{summary.targetCarbsPerHour} g/h · {summary.targetWaterPerHour} ml/h</Text>
        {lock('recap')}
      </View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 120, gap: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10 },
  lockedArea: { minHeight: 218, borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.surfaceSecondary, justifyContent: 'center' },
  blurredPreview: { ...StyleSheet.absoluteFillObject, padding: 14, justifyContent: 'space-around', opacity: 0.45 },
  placeholderRow: { gap: 10 },
  blurText: { color: 'transparent', textShadowColor: Colors.textSecondary, textShadowRadius: 7, textShadowOffset: { width: 0, height: 0 }, fontSize: 20 },
  placeholderBar: { height: 8, borderRadius: 10, backgroundColor: Colors.borderStrong, opacity: 0.45 },
  lockOverlay: { padding: 18, gap: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.80)' },
  centerText: { textAlign: 'center' },
});
