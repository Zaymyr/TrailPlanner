import Ionicons from '@expo/vector-icons/Ionicons';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { splitLabelUnit } from '../../lib/fieldLabel';
import { ActionButton } from '../themed/ActionButton';
import { Field } from '../themed/Field';
import { SheetHeader } from '../themed/SheetHeader';
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
  const distanceField = splitLabelUnit(t.planForm.distanceLabel);
  const pauseField = splitLabelUnit(t.planForm.pauseLabel);
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
            <SheetHeader
              closeLabel={t.planForm.closeEditor}
              onClose={() => setEditingStation(null)}
              showHandle={false}
              style={styles.editModalHeader}
              title={isCreateMode ? t.planForm.addAidStationTitle : t.planForm.editAidStationTitle}
            />
            {readOnlyOfficialFields ? (
              <View style={styles.officialFieldsHint}>
                <Ionicons color={Colors.textSecondary} name="lock-closed-outline" size={16} />
                <Text style={styles.officialFieldsHintText}>{t.planForm.officialFieldsLockedHint}</Text>
              </View>
            ) : null}

            <Field
              accessibilityLabel={lockedLabel(t.planForm.nameLabel)}
              accessibilityState={{ disabled: readOnlyOfficialFields }}
              containerStyle={styles.formField}
              editable={!readOnlyOfficialFields}
              label={t.planForm.nameLabel}
              onChangeText={(value) => setEditingStation((prev) => (prev ? { ...prev, name: value } : prev))}
              placeholder={t.planForm.namePlaceholder}
              trailing={readOnlyOfficialFields ? <Ionicons color={Colors.textMuted} name="lock-closed-outline" size={16} /> : null}
              value={editingStation?.name ?? ''}
            />

            <Field
              accessibilityLabel={lockedLabel(t.planForm.distanceLabel)}
              accessibilityState={{ disabled: readOnlyOfficialFields }}
              containerStyle={[styles.formField, { marginBottom: 20 }]}
              editable={!readOnlyOfficialFields}
              inputAccessoryViewID="pace-yourself-numeric-keyboard"
              keyboardType="decimal-pad"
              label={distanceField.label}
              onChangeText={(value) => setEditingStation((prev) => (prev ? { ...prev, km: value } : prev))}
              placeholder="0"
              trailing={readOnlyOfficialFields ? <Ionicons color={Colors.textMuted} name="lock-closed-outline" size={16} /> : null}
              unit={distanceField.unit}
              value={editingStation?.km ?? ''}
            />

            <Field
              accessibilityLabel={t.planForm.pauseLabel}
              containerStyle={[styles.formField, { marginBottom: 20 }]}
              inputAccessoryViewID="pace-yourself-numeric-keyboard"
              keyboardType="numeric"
              label={pauseField.label}
              onChangeText={(value) => setEditingStation((prev) => (prev ? { ...prev, pauseMinutes: value } : prev))}
              placeholder="0"
              unit={pauseField.unit}
              value={editingStation?.pauseMinutes ?? ''}
            />

            <Text style={styles.label}>{t.planForm.servicesLabel}</Text>
            <View pointerEvents={readOnlyOfficialFields ? 'none' : 'auto'} style={styles.stationServiceOptions}>
              {renderServiceOption('waterRefill', t.planForm.waterLabel, t.planForm.waterHint, 'water-outline')}
              {renderServiceOption('solidRefill', t.planForm.foodLabel, t.planForm.foodHint, 'nutrition-outline')}
              {renderServiceOption('assistanceAllowed', t.planForm.assistanceLabel, t.planForm.assistanceHint, 'people-outline')}
            </View>
            <ActionButton fullWidth onPress={onSave} style={{ marginTop: 32 }}>
              {isCreateMode ? t.planForm.addAidStationAction : t.planForm.saveAidStationAction}
            </ActionButton>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
