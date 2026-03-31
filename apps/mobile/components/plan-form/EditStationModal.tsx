import { Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { styles } from './styles';

export type EditingStation = {
  index: number;
  name: string;
  km: string;
} | null;

type Props = {
  editingStation: EditingStation;
  setEditingStation: (updater: ((prev: EditingStation) => EditingStation) | EditingStation) => void;
  onSave: () => void;
};

export function EditStationModal({ editingStation, setEditingStation, onSave }: Props) {
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
            <Text style={styles.editModalTitle}>Modifier le ravitaillement</Text>
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
          <TouchableOpacity style={styles.saveButton} onPress={onSave}>
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
