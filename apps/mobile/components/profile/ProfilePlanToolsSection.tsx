import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { Text } from '../themed/Text';

type Row = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
};

/**
 * Entry points for optional plan tooling that no longer lives in the root tabs
 * (product catalog, free training). Introduces the plan-only settings below.
 */
export function ProfilePlanToolsSection({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {rows.map((row) => (
        <Pressable
          accessibilityLabel={`${row.label}. ${row.hint}`}
          accessibilityRole="button"
          key={row.key}
          onPress={row.onPress}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          testID={`profile-plan-tool-${row.key}`}
        >
          <View style={styles.icon}>
            <Ionicons color={Colors.brandPrimary} name={row.icon} size={20} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowHint}>{row.hint}</Text>
          </View>
          <Ionicons color={Colors.textMuted} name="chevron-forward" size={18} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, backgroundColor: Colors.surface },
  header: { gap: 4 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 10, backgroundColor: Colors.surfaceSecondary },
  rowPressed: { opacity: 0.8 },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: Colors.surface },
  copy: { flex: 1, gap: 2 },
  rowLabel: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  rowHint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 16 },
});
