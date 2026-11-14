import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { ActionButton } from '../themed/ActionButton';
import { Card } from '../themed/Card';
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
    <Card style={styles.card} variationKey="profile-plan-tools">
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <ActionButton
            accessibilityLabel={`${row.label}. ${row.hint}`}
            fullWidth
            leading={<Ionicons color={Colors.brandPrimary} name={row.icon} size={18} />}
            onPress={row.onPress}
            testID={`profile-plan-tool-${row.key}`}
            trailing={<Ionicons color={Colors.textMuted} name="chevron-forward" size={18} />}
            variant="secondary"
            variationKey={`profile-plan-tool-${row.key}`}
          >
            {row.label}
          </ActionButton>
          <Text style={styles.rowHint}>{row.hint}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  header: { gap: 4 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  row: { gap: 4 },
  rowHint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 16 },
});
