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

/**
 * Discreet plan entry point for runners who have no plan yet. The plan stays
 * optional: the RaceBook shows no plan switch or plan metrics until one exists.
 */
export function RacebookPlanInviteCard({
  accentColor,
  disabled,
  onCreatePlan,
}: {
  accentColor: string;
  disabled: boolean;
  onCreatePlan: () => void;
}) {
  const { t } = useI18n();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.catalog.racebookPlanInviteTitle}. ${t.catalog.racebookCreatePlan}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onCreatePlan}
      style={[styles.inviteCard, disabled && styles.inviteDisabled]}
      testID="racebook-plan-invite"
    >
      <View style={styles.inviteIcon}>
        <Ionicons color={accentColor} name="time-outline" size={20} />
      </View>
      <View style={styles.inviteCopy}>
        <Text style={styles.inviteTitle}>{t.catalog.racebookPlanInviteTitle}</Text>
        <Text style={styles.inviteBody}>{t.catalog.racebookPlanInviteBody}</Text>
        <Text style={[styles.inviteAction, { color: accentColor }]}>{t.catalog.racebookCreatePlan}</Text>
      </View>
      <Ionicons color={Colors.textSecondary} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, backgroundColor: Colors.surface },
  inviteDisabled: { opacity: 0.6 },
  inviteIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: Colors.surfaceSecondary },
  inviteCopy: { flex: 1, gap: 3 },
  inviteTitle: { color: Colors.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  inviteBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  inviteAction: { marginTop: 2, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  revisionCard: { gap: 10, borderWidth: 1, borderColor: Colors.warning, borderRadius: 16, padding: 12, backgroundColor: Colors.warningSurface },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, padding: 11, backgroundColor: Colors.warningSurface },
  alertText: { flex: 1, color: Colors.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  reviewAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 22, borderWidth: 1, borderColor: Colors.brandBorder, paddingHorizontal: 16, backgroundColor: Colors.surface },
  reviewActionText: { color: Colors.brandPrimary, fontSize: 14, lineHeight: 18, fontWeight: '800' },
});
