import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { Text } from '../themed/Text';

export function RacebookPersonalPlanCard({
  hasPlan,
  revisionPending,
  onOpenPlan,
}: {
  hasPlan: boolean;
  revisionPending: boolean;
  onOpenPlan: () => void;
}) {
  const { t } = useI18n();
  if (!hasPlan || !revisionPending) return null;

  return (
    <View style={styles.revisionCard}>
      <View style={styles.alert}>
        <Ionicons color={Colors.warning} name="alert-circle-outline" size={18} />
        <Text style={styles.alertText}>{t.catalog.racebookPlanRevisionMessage}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onOpenPlan} style={styles.reviewAction}>
        <Text style={styles.reviewActionText}>{t.catalog.racebookReviewPlan}</Text>
        <Ionicons color={Colors.brandPrimary} name="arrow-forward" size={17} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  revisionCard: { gap: 10, borderWidth: 1, borderColor: Colors.warning, borderRadius: 16, padding: 12, backgroundColor: Colors.warningSurface },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, padding: 11, backgroundColor: Colors.warningSurface },
  alertText: { flex: 1, color: Colors.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  reviewAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 22, borderWidth: 1, borderColor: Colors.brandBorder, paddingHorizontal: 16, backgroundColor: Colors.surface },
  reviewActionText: { color: Colors.brandPrimary, fontSize: 14, lineHeight: 18, fontWeight: '800' },
});
