import Ionicons from '@expo/vector-icons/Ionicons';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';

export function CatalogLoadingCard() {
  return (
    <View style={[styles.eventCard, { opacity: 0.6 }]}>
      <View style={styles.skeletonHeaderRow}>
        <View style={styles.skeletonBadge} />
        <View style={styles.skeletonHeaderText}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>
      </View>
      <View style={styles.skeletonPillsRow}>
        <View style={styles.skeletonPill} />
        <View style={styles.skeletonPill} />
      </View>
      <View style={styles.skeletonSupportText} />
      <View style={styles.skeletonButton} />
    </View>
  );
}

export function CatalogRaceRow({
  title,
  subtitle,
  isDimmed = false,
  secondaryActionLabel,
  secondaryActionDimmed = false,
  onSecondaryPressIn,
  onSecondaryPress,
  primaryActionLabel,
  onPrimaryPress,
}: {
  title: string;
  subtitle: string;
  isDimmed?: boolean;
  secondaryActionLabel?: string;
  secondaryActionDimmed?: boolean;
  onSecondaryPressIn?: () => void;
  onSecondaryPress?: () => void;
  primaryActionLabel?: string;
  onPrimaryPress?: () => void;
}) {
  return (
    <View style={[styles.formatRow, isDimmed && styles.formatRowDimmed]}>
      <View style={styles.formatRowContent}>
        <Text style={styles.formatTitle}>{title}</Text>
        <Text style={styles.formatSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.formatActions}>
        {secondaryActionLabel && onSecondaryPress ? (
          <TouchableOpacity
            style={[
              styles.formatSecondaryActionButton,
              secondaryActionDimmed && styles.formatSecondaryActionButtonDimmed,
            ]}
            onPressIn={onSecondaryPressIn}
            onPress={onSecondaryPress}
          >
            <Text style={[
              styles.formatSecondaryActionButtonText,
              secondaryActionDimmed && styles.formatSecondaryActionButtonTextDimmed,
            ]}>{secondaryActionLabel}</Text>
          </TouchableOpacity>
        ) : null}
        {primaryActionLabel && onPrimaryPress ? (
          <TouchableOpacity style={styles.formatActionButton} onPress={onPrimaryPress}>
            <Text style={styles.formatActionButtonText}>{primaryActionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function CatalogPersonalRacesSection({
  races,
  title,
  createPlanLabel,
  onCreatePlan,
}: {
  races: Array<{ id: string; name: string; distanceKm: string; elevationLabel: string; canCreatePlan: boolean }>;
  title: string;
  createPlanLabel: string;
  onCreatePlan: (raceId: string) => void;
}) {
  return (
    <View style={styles.personalSection}>
      <View style={styles.personalSectionHeader}>
        <View style={styles.eventBadge}>
          <Ionicons name="person-outline" size={18} color={Colors.brandPrimary} />
        </View>
        <Text style={styles.personalSectionTitle}>{title}</Text>
      </View>
      <View style={styles.personalList}>
        {races.map((race) => (
          <CatalogRaceRow
            key={race.id}
            title={race.name}
            subtitle={`${race.distanceKm} km • ${race.elevationLabel}`}
            primaryActionLabel={race.canCreatePlan ? createPlanLabel : undefined}
            onPrimaryPress={race.canCreatePlan ? () => onCreatePlan(race.id) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

type FilterText = {
  modalTitle: string;
  distanceTitle: string;
  minKm: string;
  maxKm: string;
  dateTitle: string;
  minDate: string;
  maxDate: string;
  dateHint: string;
  reset: string;
  apply: string;
};

export function CatalogFiltersModal({
  visible,
  text,
  distanceMin,
  distanceMax,
  dateMin,
  dateMax,
  onChangeDistanceMin,
  onChangeDistanceMax,
  onChangeDateMin,
  onChangeDateMax,
  onClose,
  onReset,
}: {
  visible: boolean;
  text: FilterText;
  distanceMin: string;
  distanceMax: string;
  dateMin: string;
  dateMax: string;
  onChangeDistanceMin: (value: string) => void;
  onChangeDistanceMax: (value: string) => void;
  onChangeDateMin: (value: string) => void;
  onChangeDateMax: (value: string) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalBackdrop}
      >
        <Pressable accessible={false} onPress={onClose} style={styles.modalDismissArea} />
        <SafeAreaView accessibilityViewIsModal edges={['bottom']} style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text accessibilityRole="header" style={styles.modalTitle}>{text.modalTitle}</Text>
            <TouchableOpacity
              accessibilityLabel="Fermer"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            style={styles.modalScroll}
          >
            <Text style={styles.modalSectionTitle}>{text.distanceTitle}</Text>
            <View style={styles.rangeRow}>
              <TextInput value={distanceMin} onChangeText={onChangeDistanceMin} placeholder={text.minKm} placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" inputAccessoryViewID="pace-yourself-numeric-keyboard" style={[styles.filterInput, styles.rangeInput]} />
              <TextInput value={distanceMax} onChangeText={onChangeDistanceMax} placeholder={text.maxKm} placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" inputAccessoryViewID="pace-yourself-numeric-keyboard" style={[styles.filterInput, styles.rangeInput]} />
            </View>
            <Text style={styles.modalSectionTitle}>{text.dateTitle}</Text>
            <View style={styles.rangeRow}>
              <TextInput value={dateMin} onChangeText={onChangeDateMin} placeholder={text.minDate} placeholderTextColor={Colors.textMuted} style={[styles.filterInput, styles.rangeInput]} />
              <TextInput value={dateMax} onChangeText={onChangeDateMax} placeholder={text.maxDate} placeholderTextColor={Colors.textMuted} style={[styles.filterInput, styles.rangeInput]} />
            </View>
            <Text style={styles.modalHint}>{text.dateHint}</Text>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={onReset}>
              <Text style={styles.secondaryActionButtonText}>{text.reset}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryActionButton} onPress={onClose}>
              <Text style={styles.primaryActionButtonText}>{text.apply}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  eventCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3, gap: 14 },
  eventBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandSurface, borderWidth: 1, borderColor: Colors.brandBorder },
  formatRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  formatRowDimmed: { opacity: 0.58 },
  formatRowContent: { flex: 1, gap: 4 },
  formatTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  formatSubtitle: { color: Colors.textSecondary, fontSize: 13 },
  formatActionButton: { minWidth: 104, minHeight: 42, borderRadius: 10, backgroundColor: Colors.brandPrimary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  formatActionButtonText: { color: Colors.textOnBrand, fontSize: 13, fontWeight: '700' },
  formatActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formatSecondaryActionButton: { minWidth: 96, minHeight: 42, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.brandPrimary, backgroundColor: Colors.brandSurface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  formatSecondaryActionButtonText: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700' },
  formatSecondaryActionButtonDimmed: { borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  formatSecondaryActionButtonTextDimmed: { color: Colors.textMuted },
  personalSection: { gap: 12 },
  personalSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personalSectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  personalList: { gap: 10 },
  skeletonHeaderRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  skeletonBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceSecondary },
  skeletonHeaderText: { flex: 1, gap: 8 },
  skeletonTitle: { height: 18, backgroundColor: Colors.surfaceSecondary, borderRadius: 8, width: '60%' },
  skeletonSubtitle: { height: 13, backgroundColor: Colors.surfaceSecondary, borderRadius: 6, width: '40%' },
  skeletonPillsRow: { flexDirection: 'row', gap: 8 },
  skeletonPill: { width: 84, height: 28, borderRadius: 999, backgroundColor: Colors.surfaceSecondary },
  skeletonSupportText: { height: 16, borderRadius: 8, width: '70%', backgroundColor: Colors.surfaceSecondary },
  skeletonButton: { height: 48, borderRadius: 12, backgroundColor: Colors.surfaceSecondary },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18, 24, 16, 0.24)' },
  modalDismissArea: { ...StyleSheet.absoluteFillObject },
  modalSheet: { maxHeight: '90%', backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  modalCloseButton: { width: 44, height: 44, marginVertical: -10, marginRight: -10, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  modalScroll: { flexShrink: 1 },
  modalContent: { padding: 20, gap: 14 },
  modalSectionTitle: { color: Colors.brandPrimary, fontSize: 14, fontWeight: '700', marginTop: 4 },
  rangeRow: { flexDirection: 'row', gap: 10 },
  filterInput: { backgroundColor: Colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, color: Colors.textPrimary, fontSize: 15 },
  rangeInput: { flex: 1 },
  modalHint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  modalFooter: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  secondaryActionButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary, borderRadius: 14, paddingVertical: 14 },
  secondaryActionButtonText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  primaryActionButton: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandPrimary, borderRadius: 14, paddingVertical: 14 },
  primaryActionButtonText: { color: Colors.textOnBrand, fontSize: 14, fontWeight: '700' },
});
