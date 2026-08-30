import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/colors';
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
        <TouchableOpacity disabled={busy} onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>{skipLabel}</Text>
        </TouchableOpacity>
        {actionLabel && onAction ? (
          <TouchableOpacity disabled={busy} onPress={onAction} style={styles.actionButton}>
            {busy ? (
              <ActivityIndicator color={Colors.textOnBrand} size="small" />
            ) : (
              <Text style={styles.actionText}>{actionLabel}</Text>
            )}
          </TouchableOpacity>
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
  actions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  skipButton: { paddingHorizontal: 12, paddingVertical: 10 },
  skipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  actionButton: {
    minWidth: 120,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: { color: Colors.textOnBrand, fontSize: 13, fontWeight: '800' },
});
