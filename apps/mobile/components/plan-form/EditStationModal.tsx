import {
  Modal,
  Pressable,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
        style={[styles.stationServiceOption, checked && styles.stationServiceOptionActive]}
        onPress={() => updateService(field)}
        activeOpacity={0.86}
      >
        <View style={styles.stationServiceCheck}>
          <Ionicons
            name={checked ? 'checkbox' : 'square-outline'}
            size={20}
            color={checked ? Colors.brandPrimary : Colors.textMuted}
          />
        </View>
        <Ionicons name={icon} size={19} color={checked ? Colors.brandPrimary : Colors.textMuted} />
        <View style={styles.stationServiceText}>
          <Text style={styles.stationServiceLabel}>{label}</Text>
          <Text style={styles.stationServiceDescription}>{description}</Text>
        </View>
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
      <Pressable style={styles.editModalOverlay} onPress={() => setEditingStation(null)}>
        <Pressable style={styles.editModalCard} onPress={() => {}}>
          <View style={styles.editModalHeader}>
            <Text style={styles.editModalTitle}>
              {isCreateMode ? 'Ajouter un ravitaillement' : 'Modifier le ravitaillement'}
            </Text>
            <TouchableOpacity onPress={() => setEditingStation(null)} style={styles.pickerCloseBtn}>
              <Text style={styles.pickerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={styles.textInput}
            value={editingStation?.name ?? ''}
            onChangeText={(t) => setEditingStation((prev) => (prev ? { ...prev, name: t } : prev))}
            placeholder="Nom du ravitaillement"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.label}>Distance (km)</Text>
          <TextInput
            style={[styles.textInput, { marginBottom: 20 }]}
            value={editingStation?.km ?? ''}
            onChangeText={(t) => setEditingStation((prev) => (prev ? { ...prev, km: t } : prev))}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.label}>Pause (min)</Text>
          <TextInput
            style={[styles.textInput, { marginBottom: 20 }]}
            value={editingStation?.pauseMinutes ?? ''}
            onChangeText={(t) => setEditingStation((prev) => (prev ? { ...prev, pauseMinutes: t } : prev))}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.label}>Services disponibles</Text>
          <View style={styles.stationServiceOptions}>
            {renderServiceOption('waterRefill', 'Eau', 'Remplissage des flasques ou poche.', 'water-outline')}
            {renderServiceOption('solidRefill', 'Ravito solide', "Produits fournis par l'organisation.", 'nutrition-outline')}
            {renderServiceOption('assistanceAllowed', 'Assistance', "Ton equipe peut donner tes produits favoris.", 'people-outline')}
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={onSave}>
            <Text style={styles.saveButtonText}>
              {isCreateMode ? 'Ajouter le ravitaillement' : 'Enregistrer'}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
