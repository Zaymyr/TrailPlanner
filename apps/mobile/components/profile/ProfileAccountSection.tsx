import { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/colors';

type ProfileAccountSectionProps = {
  body?: string;
  dangerLabel?: string;
  dangerLoading?: boolean;
  onDangerPress?: () => void;
  onPrimaryPress: () => void;
  onSecondaryPress?: () => void;
  primaryLabel: string;
  primaryTone?: 'brand' | 'neutral';
  secondaryLabel?: string;
  title: string;
};

function ProfileAccountSectionComponent({
  body,
  dangerLabel,
  dangerLoading = false,
  onDangerPress,
  onPrimaryPress,
  onSecondaryPress,
  primaryLabel,
  primaryTone = 'neutral',
  secondaryLabel,
  title,
}: ProfileAccountSectionProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}

      <TouchableOpacity
        style={[
          styles.primaryButton,
          primaryTone === 'brand' ? styles.primaryButtonBrand : styles.primaryButtonNeutral,
        ]}
        onPress={onPrimaryPress}
      >
        <Text
          style={[
            styles.primaryButtonText,
            primaryTone === 'brand' ? styles.primaryButtonTextBrand : styles.primaryButtonTextNeutral,
          ]}
        >
          {primaryLabel}
        </Text>
      </TouchableOpacity>

      {secondaryLabel && onSecondaryPress ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={onSecondaryPress}>
          <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {dangerLabel && onDangerPress ? (
        <TouchableOpacity
          style={[styles.deleteButton, dangerLoading && styles.actionDisabled]}
          onPress={onDangerPress}
          disabled={dangerLoading}
        >
          {dangerLoading ? (
            <ActivityIndicator color={Colors.danger} />
          ) : (
            <Text style={styles.deleteButtonText}>{dangerLabel}</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const ProfileAccountSection = memo(ProfileAccountSectionComponent);

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 16,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  body: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonBrand: {
    backgroundColor: Colors.brandPrimary,
  },
  primaryButtonNeutral: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButtonTextBrand: {
    color: Colors.textOnBrand,
  },
  primaryButtonTextNeutral: {
    color: Colors.textPrimary,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2C5C5',
    backgroundColor: '#FFF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  actionDisabled: {
    opacity: 0.7,
  },
});
