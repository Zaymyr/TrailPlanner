import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { Text } from './Text';

type Props = {
  actionLabel?: string;
  bottom?: number;
  durationMs?: number | null;
  message: string;
  onAction?: () => void;
  onDismiss: () => void;
  tone?: 'success' | 'error';
};

export function BriefToast({ actionLabel, bottom = 88, durationMs, message, onAction, onDismiss, tone = 'success' }: Props) {
  useEffect(() => {
    const resolvedDuration = durationMs === undefined ? (tone === 'error' ? 5_000 : 2_600) : durationMs;
    if (resolvedDuration === null) return undefined;

    const timer = setTimeout(onDismiss, resolvedDuration);
    return () => clearTimeout(timer);
  }, [durationMs, message, onDismiss, tone]);

  return (
    <View accessibilityLiveRegion="polite" style={[styles.toast, tone === 'error' && styles.error, { bottom }]}>
      <Text numberOfLines={2} style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.action}>
          <Text weight="bold" style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', zIndex: 80, left: 16, right: 16, minHeight: 48,
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12,
    borderBottomRightRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)',
    backgroundColor: Colors.brandPrimary, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18,
    shadowRadius: 8, elevation: 8,
  },
  error: { backgroundColor: Colors.danger, borderColor: 'rgba(255,255,255,0.32)' },
  message: { flex: 1, color: Colors.textOnBrand },
  action: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
  actionText: { color: Colors.textOnBrand },
});
