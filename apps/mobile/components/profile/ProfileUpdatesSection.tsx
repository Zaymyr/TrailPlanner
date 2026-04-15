import { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/colors';

type InfoRow = {
  label: string;
  value: string;
};

type ProfileUpdatesSectionProps = {
  adminRows: InfoRow[];
  buildText?: string | null;
  changelogButtonLabel: string;
  checkingUpdates?: boolean;
  emergencyLaunchMessage?: string | null;
  onCheckForUpdates: () => void;
  onOpenChangelog: () => void;
  rows: InfoRow[];
  title: string;
  updateCheckButtonLabel: string;
  updateCheckMessage?: string | null;
  versionText: string;
};

function ProfileUpdatesSectionComponent({
  adminRows,
  buildText,
  changelogButtonLabel,
  checkingUpdates = false,
  emergencyLaunchMessage,
  onCheckForUpdates,
  onOpenChangelog,
  rows,
  title,
  updateCheckButtonLabel,
  updateCheckMessage,
  versionText,
}: ProfileUpdatesSectionProps) {
  return (
    <View style={styles.group}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.versionText}>{versionText}</Text>
        {buildText ? <Text style={styles.buildText}>{buildText}</Text> : null}

        {adminRows.map((row) => (
          <View key={`${row.label}-${row.value}`} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{row.label}</Text>
            <Text style={styles.infoValue}>{row.value}</Text>
          </View>
        ))}

        {rows.map((row) => (
          <View key={`${row.label}-${row.value}`} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{row.label}</Text>
            <Text style={styles.infoValue}>{row.value}</Text>
          </View>
        ))}

        {emergencyLaunchMessage ? <Text style={styles.message}>{emergencyLaunchMessage}</Text> : null}

        <TouchableOpacity
          style={[styles.updateButton, checkingUpdates && styles.actionDisabled]}
          onPress={onCheckForUpdates}
          disabled={checkingUpdates}
        >
          {checkingUpdates ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <Text style={styles.updateButtonText}>{updateCheckButtonLabel}</Text>
          )}
        </TouchableOpacity>

        {updateCheckMessage ? <Text style={styles.message}>{updateCheckMessage}</Text> : null}
      </View>

      <TouchableOpacity style={styles.changelogButton} onPress={onOpenChangelog}>
        <Text style={styles.changelogButtonText}>{changelogButtonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export const ProfileUpdatesSection = memo(ProfileUpdatesSectionComponent);

const styles = StyleSheet.create({
  group: {
    gap: 12,
  },
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
  versionText: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  buildText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  infoValue: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  message: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  updateButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  updateButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  actionDisabled: {
    opacity: 0.7,
  },
  changelogButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  changelogButtonText: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
});
