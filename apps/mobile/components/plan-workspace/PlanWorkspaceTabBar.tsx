import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import type { PlanWorkspaceTab } from '../../lib/planWorkspace';
import { Text } from '../themed/Text';

type Props = {
  activeTab: PlanWorkspaceTab;
  onSelectTab: (tab: PlanWorkspaceTab) => void;
  onExit: () => void;
};

const TABS: { key: PlanWorkspaceTab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'plan', icon: 'clipboard-outline' },
  { key: 'recap', icon: 'reader' },
  { key: 'settings', icon: 'options' },
];

export function PlanWorkspaceTabBar({ activeTab, onSelectTab, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const labels = { plan: t.planWorkspace.myPlan, recap: t.planWorkspace.recap, settings: t.planWorkspace.settings };

  return (
    <View style={[styles.safeArea, { paddingBottom: Math.max(8, insets.bottom) }]}>
      <View accessibilityRole="tablist" style={styles.wrap}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab.key}
              onPress={() => onSelectTab(tab.key)}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Ionicons name={tab.icon} size={24} color={selected ? Colors.brandPrimary : Colors.textMuted} />
              <Text numberOfLines={1} style={[styles.label, selected && styles.labelSelected]}>
                {labels[tab.key]}
              </Text>
            </Pressable>
          );
        })}
        <View style={styles.divider} />
        <Pressable
          accessibilityLabel={t.planWorkspace.saveAndBackToPlans}
          accessibilityRole="button"
          onPress={onExit}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          testID="plan-workspace-exit"
        >
          <Ionicons name="map" size={24} color={Colors.textSecondary} />
          <Text numberOfLines={1} style={styles.exitLabel}>{t.planWorkspace.plans}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  wrap: { minHeight: 62, flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 4, paddingTop: 4 },
  button: { flex: 1, minWidth: 0, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
  pressed: { opacity: 0.62 },
  label: { color: Colors.textMuted, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  labelSelected: { color: Colors.brandPrimary },
  exitLabel: { color: Colors.textSecondary, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  divider: { width: 1, marginHorizontal: 1, marginVertical: 10, backgroundColor: Colors.border },
});
