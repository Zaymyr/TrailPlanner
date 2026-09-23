import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
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
};

export function EditStationModal({ editingStation, setEditingStation, onSave }: Props) {
  const isCreateMode = editingStation?.mode === 'create';
  const updateService = (field: 'waterRefill' | 'solidRefill' | 'assistanceAllowed') => {
    setEditingStation((prev) => (prev ? { ...prev, [field]: !prev[field] } : prev));
  };
  const renderServiceOption = (
    field: 'waterRefill' | 'solidRefill' | 'assistanceAllowed',
    label: string,
    description: string,
    icon: keyof typeof Ionicons.glyphMap,
  ) => {
    const checked = Boolean(editingStation?.[field]);

    return (
      <TouchableOpacity
        accessibilityLabel={label}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityHint={description}
        style={[styles.stationServiceOption, checked && styles.stationServiceOptionActive]}
        onPress={() => updateService(field)}
        activeOpacity={0.86}
      >
        <Ionicons name={icon} size={19} color={checked ? Colors.brandPrimary : Colors.textMuted} />
        <Text numberOfLines={2} style={[styles.stationServiceLabel, checked && styles.stationServiceLabelActive]}>
          {label}
        </Text>
        <Ionicons
          name={checked ? 'checkmark-circle' : 'ellipse-outline'}
          size={16}
          color={checked ? Colors.brandPrimary : Colors.textMuted}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={editingStation !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setEditingStation(null)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.editModalOverlay}
      >
        <Pressable
          accessible={false}
          onPress={() => setEditingStation(null)}
          style={styles.editModalBackdrop}
        />
        <View accessibilityViewIsModal style={styles.editModalCard}>
          <ScrollView
            contentContainerStyle={styles.editModalContent}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.editModalHeader}>
              <Text accessibilityRole="header" style={styles.editModalTitle}>
                {isCreateMode ? 'Ajouter un ravitaillement' : 'Modifier le ravitaillement'}
              </Text>
              <TouchableOpacity
                accessibilityLabel="Fermer"
                accessibilityRole="button"
                onPress={() => setEditingStation(null)}
              style={[styles.pickerCloseBtn, styles.editModalCloseButton]}
              >
                <Text style={styles.pickerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Nom</Text>
            <TextInput
              accessibilityLabel="Nom"
              style={styles.textInput}
              value={editingStation?.name ?? ''}
              onChangeText={(t) => setEditingStation((prev) => (prev ? { ...prev, name: t } : prev))}
              placeholder="Nom du ravitaillement"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.label}>Distance (km)</Text>
            <TextInput
              accessibilityLabel="Distance en kilomètres"
              style={[styles.textInput, { marginBottom: 20 }]}
              value={editingStation?.km ?? ''}
              onChangeText={(t) => setEditingStation((prev) => (prev ? { ...prev, km: t } : prev))}
              keyboardType="numeric"
              inputAccessoryViewID="pace-yourself-numeric-keyboard"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.label}>Pause (min)</Text>
            <TextInput
              accessibilityLabel="Pause en minutes"
              style={[styles.textInput, { marginBottom: 20 }]}
              value={editingStation?.pauseMinutes ?? ''}
              onChangeText={(t) => setEditingStation((prev) => (prev ? { ...prev, pauseMinutes: t } : prev))}
              keyboardType="numeric"
              inputAccessoryViewID="pace-yourself-numeric-keyboard"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.label}>Services disponibles</Text>
            <View style={styles.stationServiceOptions}>
              {renderServiceOption('waterRefill', 'Eau', 'Remplissage des flasques ou de la poche', 'water-outline')}
              {renderServiceOption('solidRefill', 'Solide', "Produits fournis par l'organisation", 'nutrition-outline')}
              {renderServiceOption('assistanceAllowed', 'Assistance', "Remise de tes produits par l'équipe", 'people-outline')}
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={onSave}>
              <Text style={styles.saveButtonText}>
                {isCreateMode ? 'Ajouter le ravitaillement' : 'Enregistrer'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
