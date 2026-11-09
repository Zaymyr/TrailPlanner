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
import { DatePickerField } from '../inputs/DatePickerField';

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

/**
 * One format of an event. The RaceBook is the primary (filled) action; the
 * optional personal plan is a secondary (outlined) action.
 */
export function CatalogRaceRow({
  title,
  subtitle,
  isDimmed = false,
  racebookActionLabel,
  racebookActionDimmed = false,
  racebookActionDisabled = false,
  onRacebookPressIn,
  onRacebookPress,
  planActionLabel,
  onPlanPress,
}: {
  title: string;
  subtitle: string;
  isDimmed?: boolean;
  racebookActionLabel?: string;
  racebookActionDimmed?: boolean;
  racebookActionDisabled?: boolean;
  onRacebookPressIn?: () => void;
  onRacebookPress?: () => void;
  planActionLabel?: string;
  onPlanPress?: () => void;
}) {
  const racebookMuted = racebookActionDimmed || racebookActionDisabled;
  return (
    <View style={[styles.formatRow, isDimmed && styles.formatRowDimmed]}>
      <View style={styles.formatRowContent}>
        <Text style={styles.formatTitle}>{title}</Text>
        <Text style={styles.formatSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.formatActions}>
        {racebookActionLabel && onRacebookPress ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: racebookActionDisabled }}
            disabled={racebookActionDisabled}
            style={[styles.formatRacebookButton, racebookMuted && styles.formatRacebookButtonDimmed]}
            onPressIn={onRacebookPressIn}
            onPress={onRacebookPress}
          >
            <Text style={[styles.formatRacebookButtonText, racebookMuted && styles.formatRacebookButtonTextDimmed]}>
              {racebookActionLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
        {planActionLabel && onPlanPress ? (
          <TouchableOpacity accessibilityRole="button" style={styles.formatPlanButton} onPress={onPlanPress}>
            <Text style={styles.formatPlanButtonText}>{planActionLabel}</Text>
          </TouchableOpacity>
        ) : null}
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
  clearDate: string;
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
  locale,
  datePickerUnavailableMessage,
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
  locale: 'fr' | 'en';
  datePickerUnavailableMessage: string;
}) {
  const parsedDateMin = parseIsoDate(dateMin);
  const parsedDateMax = parseIsoDate(dateMax);

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
              <View style={styles.dateFieldColumn}>
                <DatePickerField
                  accessibilityLabel={text.minDate}
                  locale={locale}
                  onChange={(date) => {
                    onChangeDateMin(formatIsoDate(date));
                    if (parsedDateMax && parsedDateMax < date) onChangeDateMax('');
                  }}
                  placeholder={text.minDate}
                  unavailableMessage={datePickerUnavailableMessage}
                  value={parsedDateMin}
                />
                {dateMin ? (
                  <TouchableOpacity accessibilityRole="button" onPress={() => onChangeDateMin('')}>
                    <Text style={styles.clearDateText}>{text.clearDate}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.dateFieldColumn}>
                <DatePickerField
                  accessibilityLabel={text.maxDate}
                  locale={locale}
                  minimumDate={parsedDateMin ?? undefined}
                  onChange={(date) => onChangeDateMax(formatIsoDate(date))}
                  placeholder={text.maxDate}
                  unavailableMessage={datePickerUnavailableMessage}
                  value={parsedDateMax}
                />
                {dateMax ? (
                  <TouchableOpacity accessibilityRole="button" onPress={() => onChangeDateMax('')}>
                    <Text style={styles.clearDateText}>{text.clearDate}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
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

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  eventCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3, gap: 14 },
  formatRow: { gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  formatRowDimmed: { opacity: 0.58 },
  formatRowContent: { flex: 1, gap: 4 },
  formatTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  formatSubtitle: { color: Colors.textSecondary, fontSize: 13 },
  formatActions: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  formatRacebookButton: { flex: 3, minHeight: 44, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.brandPrimary, backgroundColor: Colors.brandPrimary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  formatRacebookButtonText: { color: Colors.textOnBrand, fontSize: 13, fontWeight: '800' },
  formatRacebookButtonDimmed: { borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary },
  formatRacebookButtonTextDimmed: { color: Colors.textMuted },
  formatPlanButton: { flex: 2, minHeight: 44, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.brandBorder, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  formatPlanButtonText: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700' },
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
  dateFieldColumn: { flex: 1, gap: 6 },
  clearDateText: { color: Colors.brandPrimary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  modalHint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  modalFooter: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  secondaryActionButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSecondary, borderRadius: 14, paddingVertical: 14 },
  secondaryActionButtonText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  primaryActionButton: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandPrimary, borderRadius: 14, paddingVertical: 14 },
  primaryActionButtonText: { color: Colors.textOnBrand, fontSize: 14, fontWeight: '700' },
});
