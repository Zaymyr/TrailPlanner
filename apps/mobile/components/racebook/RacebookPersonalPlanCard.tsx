import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { Text } from '../themed/Text';

export function RacebookPersonalPlanCard({
  hasPlan,
  revisionPending,
  locale,
  onOpenPlan,
}: {
  hasPlan: boolean;
  revisionPending: boolean;
  locale: 'fr' | 'en';
  onOpenPlan: () => void;
}) {
  const copy = locale === 'fr' ? {
    title: 'Mon plan pour cette course',
    empty: 'Crée ton plan personnel à partir des informations officielles, puis affine allure, pauses et nutrition.',
    create: 'Créer mon plan',
    review: 'Revoir mon plan',
    revision: 'L’organisation a modifié des informations qui peuvent influencer ton plan. Tes choix personnels restent inchangés.',
  } : {
    title: 'My plan for this race',
    empty: 'Create your personal plan from the official information, then refine pace, stops and nutrition.',
    create: 'Create my plan',
    review: 'Review my plan',
    revision: 'The organizer changed information that may affect your plan. Your personal choices remain unchanged.',
  };

  if (hasPlan && !revisionPending) return null;

  if (hasPlan) {
    return (
      <View style={styles.revisionCard}>
        <View style={styles.alert}>
          <Ionicons color={Colors.warning} name="alert-circle-outline" size={18} />
          <Text style={styles.alertText}>{copy.revision}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onOpenPlan} style={styles.reviewAction}>
          <Text style={styles.reviewActionText}>{copy.review}</Text>
          <Ionicons color={Colors.brandPrimary} name="arrow-forward" size={17} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons color={Colors.brandPrimary} name="clipboard-outline" size={20} />
        <Text style={styles.title}>{copy.title}</Text>
      </View>
      <Text style={styles.body}>{copy.empty}</Text>
      <Pressable accessibilityRole="button" onPress={onOpenPlan} style={styles.action}>
        <Text style={styles.actionText}>{copy.create}</Text>
        <Ionicons color={Colors.textOnBrand} name="arrow-forward" size={17} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 13, borderWidth: 1, borderColor: Colors.brandBorder, borderRadius: 20, padding: 16, backgroundColor: Colors.brandSurface },
  revisionCard: { gap: 10, borderWidth: 1, borderColor: Colors.warning, borderRadius: 16, padding: 12, backgroundColor: Colors.warningSurface },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, padding: 11, backgroundColor: Colors.warningSurface },
  alertText: { flex: 1, color: Colors.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 22, paddingHorizontal: 16, backgroundColor: Colors.brandPrimary },
  actionText: { color: Colors.textOnBrand, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  reviewAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 22, borderWidth: 1, borderColor: Colors.brandBorder, paddingHorizontal: 16, backgroundColor: Colors.surface },
  reviewActionText: { color: Colors.brandPrimary, fontSize: 14, lineHeight: 18, fontWeight: '800' },
});
