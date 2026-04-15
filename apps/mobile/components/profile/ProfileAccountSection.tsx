import { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/colors';

type ProfileAccountSectionProps = {
  deleteLabel: string;
  deleting?: boolean;
  logoutLabel: string;
  onDeleteAccount: () => void;
  onLogout: () => void;
  title: string;
};

function ProfileAccountSectionComponent({
  deleteLabel,
  deleting = false,
  logoutLabel,
  onDeleteAccount,
  onLogout,
  title,
}: ProfileAccountSectionProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>{logoutLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.deleteButton, deleting && styles.actionDisabled]}
        onPress={onDeleteAccount}
        disabled={deleting}
      >
        {deleting ? (
          <ActivityIndicator color={Colors.danger} />
        ) : (
          <Text style={styles.deleteButtonText}>{deleteLabel}</Text>
        )}
      </TouchableOpacity>
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
  logoutButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  logoutButtonText: {
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
