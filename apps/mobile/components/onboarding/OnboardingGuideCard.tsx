import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { ActionButton } from '../themed/ActionButton';
import { Text } from '../themed/Text';

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  skipLabel: string;
  onSkip: () => void;
  busy?: boolean;
};

export function OnboardingGuideCard({
  title,
  body,
  actionLabel,
  onAction,
  skipLabel,
  onSkip,
  busy = false,
}: Props) {
  return (
    <View accessibilityRole="summary" style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" color={Colors.brandPrimary} size={18} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <ActionButton disabled={busy} onPress={onSkip} size="sm" variant="ghost">
          {skipLabel}
        </ActionButton>
        {actionLabel && onAction ? (
          <ActionButton isLoading={busy} onPress={onAction} size="sm" style={styles.actionButton} variant="secondary">
            {actionLabel}
          </ActionButton>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    zIndex: 100,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.surface,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  headingRow: { flexDirection: 'row', gap: 10 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandSurface,
  },
  copy: { flex: 1, gap: 3 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  actions: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  actionButton: { minWidth: 120 },
});
