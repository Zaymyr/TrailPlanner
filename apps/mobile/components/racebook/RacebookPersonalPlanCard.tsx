import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@pace-yourself/design-system';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { DataText } from '../themed/DataText';
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

/** Unknown passing time, until the runner builds a plan. */
const UNKNOWN_CLOCK = '?:??';

type InviteStop = { key: string; label: string; time: string; kind: 'start' | 'aid' | 'finish' };

/**
 * Teaser of the passing times: start, aid stations and finish on a dashed
 * trail, only the start time known. Decorative; the card label says it all.
 */
function InviteTrail({ stops }: { stops: InviteStop[] }) {
  const edge = `${100 / (stops.length * 2)}%` as const;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.trail}>
      <View style={[styles.trailPath, { left: edge, right: edge }]}>
        <Svg accessible={false} height={2} pointerEvents="none" width="100%">
          <Line stroke={Colors.borderStrong} strokeDasharray={[4, 3]} strokeWidth={2} x1="0" x2="100%" y1="1" y2="1" />
        </Svg>
      </View>
      {stops.map((stop) => (
        <View key={stop.key} style={styles.trailStop}>
          <View
            style={[
              styles.trailMarker,
              stop.kind === 'start' ? styles.trailMarkerStart : null,
              stop.kind === 'aid' ? styles.trailMarkerAid : null,
              stop.kind === 'finish' ? styles.trailMarkerFinish : null,
            ]}
          />
          <DataText size="sm" weight="bold" style={stop.time === UNKNOWN_CLOCK ? styles.trailTimeUnknown : styles.trailTime}>
            {stop.time}
          </DataText>
          <DataText numberOfLines={2} size="xs" weight="semibold" style={styles.trailLabel}>
            {stop.label.toLocaleUpperCase()}
          </DataText>
        </View>
      ))}
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
  startTime = null,
}: {
  accentColor: string;
  disabled: boolean;
  onCreatePlan: () => void;
  /** Official or personal start clock ("10:00"); unknown times show "?:??". */
  startTime?: string | null;
}) {
  const { t } = useI18n();
  const stops: InviteStop[] = [
    { key: 'start', kind: 'start', label: t.catalog.racebookMapStart, time: startTime || UNKNOWN_CLOCK },
    { key: 'aid', kind: 'aid', label: t.catalog.racebookCourseTabAidStations, time: UNKNOWN_CLOCK },
    { key: 'finish', kind: 'finish', label: t.catalog.racebookMapFinish, time: UNKNOWN_CLOCK },
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.catalog.racebookPlanInviteTitle}. ${t.catalog.racebookCreatePlan}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onCreatePlan}
      style={({ pressed }) => [styles.inviteCard, pressed && !disabled ? styles.invitePressed : null, disabled && styles.inviteDisabled]}
      testID="racebook-plan-invite"
    >
      <View style={styles.inviteCopy}>
        <Text style={styles.inviteTitle}>{t.catalog.racebookPlanInviteTitle}</Text>
        <Text style={styles.inviteBody}>{t.catalog.racebookPlanInviteBody}</Text>
      </View>
      <InviteTrail stops={stops} />
      <View style={styles.inviteActionRow}>
        <Text style={[styles.inviteAction, { color: accentColor }]}>{t.catalog.racebookCreatePlan}</Text>
        <Ionicons color={accentColor} name="chevron-forward" size={16} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inviteCard: {
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: Colors.border,
    padding: 16,
    backgroundColor: Colors.surface,
  },
  invitePressed: { opacity: 0.86 },
  inviteDisabled: { opacity: 0.6 },
  inviteCopy: { gap: 4 },
  inviteTitle: { color: Colors.textPrimary, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  inviteBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 19 },
  inviteActionRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 2 },
  inviteAction: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  trail: { flexDirection: 'row', paddingTop: 6 },
  // Marker centres sit at 6 + 7pt from the top: the dashed path runs through them.
  trailPath: { position: 'absolute', top: 12, height: 2 },
  trailStop: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  trailMarker: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  trailMarkerStart: { borderColor: Colors.surface, backgroundColor: Colors.brandPrimary },
  trailMarkerAid: { borderColor: colors.trail.pinAmber, backgroundColor: Colors.surface },
  trailMarkerFinish: { borderRadius: 3, borderColor: Colors.brandPrimary, backgroundColor: Colors.surface },
  trailTime: { color: Colors.textPrimary },
  trailTimeUnknown: { color: Colors.textSecondary },
  trailLabel: { color: Colors.textSecondary, fontSize: 10, lineHeight: 13, letterSpacing: 1.4, textAlign: 'center' },
  revisionCard: { gap: 10, borderWidth: 1, borderColor: Colors.warning, borderRadius: 16, padding: 12, backgroundColor: Colors.warningSurface },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, padding: 11, backgroundColor: Colors.warningSurface },
  alertText: { flex: 1, color: Colors.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  reviewAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 22, borderWidth: 1, borderColor: Colors.brandBorder, paddingHorizontal: 16, backgroundColor: Colors.surface },
  reviewActionText: { color: Colors.brandPrimary, fontSize: 14, lineHeight: 18, fontWeight: '800' },
});
