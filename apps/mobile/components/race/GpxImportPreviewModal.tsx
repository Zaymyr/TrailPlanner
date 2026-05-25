import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import type { ImportedGpxDocument } from '../../lib/race-import';

type GpxImportPreviewModalProps = {
  visible: boolean;
  document: ImportedGpxDocument | null;
  raceName: string;
  onRaceNameChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirming?: boolean;
};

function formatDistance(distanceKm: number) {
  return distanceKm >= 100 ? distanceKm.toFixed(0) : distanceKm.toFixed(1);
}

export function GpxImportPreviewModal({
  visible,
  document,
  raceName,
  onRaceNameChange,
  onCancel,
  onConfirm,
  confirming = false,
}: GpxImportPreviewModalProps) {
  const { locale, t } = useI18n();

  if (!document) {
    return null;
  }

  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US';
  const parsed = document.parsed;
  const hasRaceName = raceName.trim().length > 0;

  const stats = [
    {
      label: t.races.distanceLabel,
      value: `${formatDistance(parsed.stats.distanceKm)} km`,
    },
    {
      label: t.races.elevationGainLabel,
      value: parsed.hasElevation ? `${Math.round(parsed.stats.gainM)} m` : '-',
    },
    {
      label: t.races.elevationLossLabel,
      value: parsed.hasElevation ? `${Math.round(parsed.stats.lossM)} m` : '-',
    },
    {
      label: t.races.gpxPreviewPointsLabel,
      value: parsed.pointCount.toLocaleString(numberLocale),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>{t.races.gpxPreview}</Text>
          <Text style={styles.subtitle}>{t.races.gpxPreviewSubtitle}</Text>

          <View style={styles.section}>
            <Text style={styles.label}>{t.races.gpxSelected}</Text>
            <Text style={styles.fileName} selectable numberOfLines={2}>
              {document.fileName}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{t.races.nameLabel}</Text>
            <TextInput
              style={styles.input}
              value={raceName}
              onChangeText={onRaceNameChange}
              placeholder={t.races.namePlaceholder}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.statsGrid}>
            {stats.map((item) => (
              <View key={item.label} style={styles.statCard}>
                <Text style={styles.statLabel}>{item.label}</Text>
                <Text style={styles.statValue} selectable>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.feedbackCard,
              document.feedback.tone === 'warning'
                ? styles.feedbackCardWarning
                : styles.feedbackCardSuccess,
            ]}
          >
            <Text style={styles.feedbackText}>{document.feedback.message}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.secondaryButton, confirming && styles.buttonDisabled]}
              onPress={onCancel}
              disabled={confirming}
            >
              <Text style={styles.secondaryButtonText}>{t.common.cancel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!hasRaceName || confirming) && styles.buttonDisabled,
              ]}
              onPress={onConfirm}
              disabled={!hasRaceName || confirming}
            >
              {confirming ? (
                <ActivityIndicator color={Colors.textOnBrand} />
              ) : (
                <Text style={styles.primaryButtonText}>{t.races.gpxPreviewConfirmCta}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 14,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  section: {
    gap: 8,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  fileName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  input: {
    backgroundColor: Colors.surfaceSecondary,
    color: Colors.textPrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  feedbackCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  feedbackCardSuccess: {
    backgroundColor: Colors.brandSurface,
    borderColor: Colors.brandBorder,
  },
  feedbackCardWarning: {
    backgroundColor: Colors.warningSurface,
    borderColor: Colors.warning,
  },
  feedbackText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 15,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: Colors.textOnBrand,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
