import { memo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '../../constants/colors';
import type { ChangelogEntry } from './types';

type ProfileChangelogModalProps = {
  closeLabel: string;
  emptyLabel: string;
  entries: ChangelogEntry[];
  errorMessage?: string | null;
  loading?: boolean;
  onClose: () => void;
  resolveDetail: (entry: ChangelogEntry) => string;
  subtitle: string;
  title: string;
  versionMetaFormatter: (entry: ChangelogEntry) => string;
  visible: boolean;
};

function ProfileChangelogModalComponent({
  closeLabel,
  emptyLabel,
  entries,
  errorMessage,
  loading = false,
  onClose,
  resolveDetail,
  subtitle,
  title,
  versionMetaFormatter,
  visible,
}: ProfileChangelogModalProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalWrapper}>
        <Pressable style={styles.modalOverlay} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.modalSubtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Text style={styles.modalCloseButtonText}>{closeLabel}</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={Colors.brandPrimary} />
            </View>
          ) : null}

          {!loading && errorMessage ? (
            <View style={styles.state}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {!loading && !errorMessage ? (
            <ScrollView contentContainerStyle={styles.list}>
              {entries.length === 0 ? (
                <Text style={styles.emptyText}>{emptyLabel}</Text>
              ) : (
                entries.map((entry) => (
                  <View key={entry.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{entry.title}</Text>
                    <Text style={styles.cardMeta}>{versionMetaFormatter(entry)}</Text>
                    <Text style={styles.cardDetail}>{resolveDetail(entry)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export const ProfileChangelogModal = memo(ProfileChangelogModalComponent);

const styles = StyleSheet.create({
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '78%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  modalHeaderContent: {
    flex: 1,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  modalCloseButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCloseButtonText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    paddingBottom: 12,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    padding: 14,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  cardMeta: {
    color: Colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  cardDetail: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
});
