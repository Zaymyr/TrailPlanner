import Ionicons from '@expo/vector-icons/Ionicons';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { Text } from '../themed/Text';
import { styles } from './styles';

export type EditingStation = {
  mode: 'create' | 'edit';
  index: number;
  name: string;
  km: string;
  pauseMinutes: string;
  waterRefill: boolean;
  solidRefill: boolean;
  assistanceAllowed: boolean;
} | null;

type Props = {
  editingStation: EditingStation;
  setEditingStation: (updater: ((prev: EditingStation) => EditingStation) | EditingStation) => void;
  onSave: () => void;
  officialFieldsReadOnly?: boolean;
};

export function EditStationModal({ editingStation, setEditingStation, onSave, officialFieldsReadOnly = false }: Props) {
  const { t } = useI18n();
  const isCreateMode = editingStation?.mode === 'create';
  const readOnlyOfficialFields = officialFieldsReadOnly && !isCreateMode;
  const updateService = (field: 'waterRefill' | 'solidRefill' | 'assistanceAllowed') => {
    setEditingStation((prev) => (prev ? { ...prev, [field]: !prev[field] } : prev));
  };
  const lockedLabel = (label: string) => [label, readOnlyOfficialFields ? t.planForm.notEditable : null].filter(Boolean).join(', ');
  const renderServiceOption = (
    field: 'waterRefill' | 'solidRefill' | 'assistanceAllowed',
    label: string,
    description: string,
    icon: keyof typeof Ionicons.glyphMap,
  ) => {
    const checked = Boolean(editingStation?.[field]);
    return (
      <TouchableOpacity
        accessibilityHint={description}
        accessibilityLabel={lockedLabel(label)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: readOnlyOfficialFields }}
        activeOpacity={0.86}
        disabled={readOnlyOfficialFields}
        onPress={() => updateService(field)}
        style={[
          styles.stationServiceOption,
          checked && !readOnlyOfficialFields && styles.stationServiceOptionActive,
          readOnlyOfficialFields && styles.stationServiceOptionLocked,
        ]}
      >
        <Ionicons name={icon} size={19} color={checked && !readOnlyOfficialFields ? Colors.brandPrimary : Colors.textMuted} />
        <Text numberOfLines={2} style={[styles.stationServiceLabel, checked && !readOnlyOfficialFields && styles.stationServiceLabelActive]}>
          {label}
        </Text>
        <Ionicons
          name={readOnlyOfficialFields ? 'lock-closed-outline' : checked ? 'checkmark-circle' : 'ellipse-outline'}
          size={16}
          color={checked && !readOnlyOfficialFields ? Colors.brandPrimary : Colors.textMuted}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={editingStation !== null} transparent animationType="fade" onRequestClose={() => setEditingStation(null)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.editModalOverlay}>
        <Pressable accessible={false} onPress={() => setEditingStation(null)} style={styles.editModalBackdrop} />
        <View accessibilityViewIsModal style={styles.editModalCard}>
          <ScrollView
            contentContainerStyle={styles.editModalContent}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.editModalHeader}>
              <Text accessibilityRole="header" style={styles.editModalTitle}>
                {isCreateMode ? t.planForm.addAidStationTitle : t.planForm.editAidStationTitle}
              </Text>
              <TouchableOpacity accessibilityLabel={t.planForm.closeEditor} accessibilityRole="button" onPress={() => setEditingStation(null)} style={[styles.pickerCloseBtn, styles.editModalCloseButton]}>
                <Ionicons color={Colors.textPrimary} name="close" size={22} />
              </TouchableOpacity>
            </View>
            {readOnlyOfficialFields ? (
              <View style={styles.officialFieldsHint}>
                <Ionicons color={Colors.textSecondary} name="lock-closed-outline" size={16} />
                <Text style={styles.officialFieldsHintText}>{t.planForm.officialFieldsLockedHint}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>{t.planForm.nameLabel}</Text>
            <View style={readOnlyOfficialFields ? styles.lockedInputWrap : undefined}>
              <TextInput accessibilityLabel={lockedLabel(t.planForm.nameLabel)} accessibilityState={{ disabled: readOnlyOfficialFields }} editable={!readOnlyOfficialFields} onChangeText={(value) => setEditingStation((prev) => (prev ? { ...prev, name: value } : prev))} placeholder={t.planForm.namePlaceholder} placeholderTextColor={Colors.textMuted} style={[styles.textInput, readOnlyOfficialFields && styles.textInputLocked]} value={editingStation?.name ?? ''} />
              {readOnlyOfficialFields ? <Ionicons color={Colors.textMuted} name="lock-closed-outline" size={16} style={styles.lockedInputIcon} /> : null}
            </View>

            <Text style={styles.label}>{t.planForm.distanceLabel}</Text>
            <View style={readOnlyOfficialFields ? styles.lockedInputWrap : undefined}>
              <TextInput accessibilityLabel={lockedLabel(t.planForm.distanceLabel)} accessibilityState={{ disabled: readOnlyOfficialFields }} editable={!readOnlyOfficialFields} inputAccessoryViewID="pace-yourself-numeric-keyboard" keyboardType="decimal-pad" onChangeText={(value) => setEditingStation((prev) => (prev ? { ...prev, km: value } : prev))} placeholder="0" placeholderTextColor={Colors.textMuted} style={[styles.textInput, { marginBottom: 20 }, readOnlyOfficialFields && styles.textInputLocked]} value={editingStation?.km ?? ''} />
              {readOnlyOfficialFields ? <Ionicons color={Colors.textMuted} name="lock-closed-outline" size={16} style={styles.lockedInputIcon} /> : null}
            </View>

            <Text style={styles.label}>{t.planForm.pauseLabel}</Text>
            <TextInput accessibilityLabel={t.planForm.pauseLabel} inputAccessoryViewID="pace-yourself-numeric-keyboard" keyboardType="numeric" onChangeText={(value) => setEditingStation((prev) => (prev ? { ...prev, pauseMinutes: value } : prev))} placeholder="0" placeholderTextColor={Colors.textMuted} style={[styles.textInput, { marginBottom: 20 }]} value={editingStation?.pauseMinutes ?? ''} />

            <Text style={styles.label}>{t.planForm.servicesLabel}</Text>
            <View pointerEvents={readOnlyOfficialFields ? 'none' : 'auto'} style={styles.stationServiceOptions}>
              {renderServiceOption('waterRefill', t.planForm.waterLabel, t.planForm.waterHint, 'water-outline')}
              {renderServiceOption('solidRefill', t.planForm.foodLabel, t.planForm.foodHint, 'nutrition-outline')}
              {renderServiceOption('assistanceAllowed', t.planForm.assistanceLabel, t.planForm.assistanceHint, 'people-outline')}
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={onSave}>
              <Text style={styles.saveButtonText}>{isCreateMode ? t.planForm.addAidStationAction : t.planForm.saveAidStationAction}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
