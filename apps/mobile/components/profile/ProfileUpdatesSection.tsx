import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionButton } from '../themed/ActionButton';
import { Card } from '../themed/Card';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';

type InfoRow = {
  label: string;
  value: string;
};

type ProfileUpdatesSectionProps = {
  adminRows: InfoRow[];
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
      <Card style={styles.card} variationKey="profile-updates">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.versionText}>{versionText}</Text>

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

        <ActionButton fullWidth isLoading={checkingUpdates} onPress={onCheckForUpdates} variant="secondary">
          {updateCheckButtonLabel}
        </ActionButton>

        {updateCheckMessage ? <Text style={styles.message}>{updateCheckMessage}</Text> : null}
      </Card>

      <ActionButton fullWidth onPress={onOpenChangelog} variant="secondary">
        {changelogButtonLabel}
      </ActionButton>
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
});
