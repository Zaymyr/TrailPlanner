import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/colors';
import type { OnboardingKind, OnboardingStatuses, OnboardingStatus } from '../../lib/onboardingStatus';
import type { MobileTranslations } from '../../locales/types';
import { Text } from '../themed/Text';

type Props = {
  copy: MobileTranslations['onboarding']['tours'];
  statuses: OnboardingStatuses;
  onLaunch: (kind: OnboardingKind) => void;
};

function statusLabel(status: OnboardingStatus, copy: Props['copy']) {
  const labels = {
    pending: copy.statusPending,
    in_progress: copy.statusInProgress,
    skipped: copy.statusSkipped,
    completed: copy.statusCompleted,
  };
  return labels[status];
}

function actionLabel(status: OnboardingStatus, copy: Props['copy']) {
  if (status === 'completed') return copy.actionReview;
  if (status === 'in_progress') return copy.actionResume;
  return copy.actionStart;
}

export function ProfileOnboardingSection({ copy, statuses, onLaunch }: Props) {
  const rows: Array<{ kind: OnboardingKind; title: string; icon: 'map-outline' | 'book-outline' }> = [
    { kind: 'plan', title: copy.planTitle, icon: 'map-outline' },
    { kind: 'racebook', title: copy.racebookTitle, icon: 'book-outline' },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{copy.profileTitle}</Text>
      <Text style={styles.subtitle}>{copy.profileSubtitle}</Text>
      {rows.map((row) => {
        const status = statuses[row.kind];
        return (
          <View key={row.kind} style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name={row.icon} size={20} color={Colors.brandPrimary} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={[styles.status, status === 'completed' && styles.statusCompleted]}>
                {statusLabel(status, copy)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => onLaunch(row.kind)} style={styles.button}>
              <Text style={styles.buttonText}>{actionLabel(status, copy)}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, padding: 16, gap: 10 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandSurface },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  status: { color: Colors.warning, fontSize: 12, fontWeight: '700' },
  statusCompleted: { color: Colors.success },
  button: { borderRadius: 11, backgroundColor: Colors.brandPrimary, paddingHorizontal: 12, paddingVertical: 9 },
  buttonText: { color: Colors.textOnBrand, fontSize: 12, fontWeight: '800' },
});
