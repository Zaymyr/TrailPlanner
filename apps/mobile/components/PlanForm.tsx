import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

export type AidStationFormItem = {
  name: string;
  distanceKm: number;
  waterRefill: boolean;
};

export type PlanFormValues = {
  name: string;
  raceDistanceKm: number;
  elevationGain: number;
  paceType: 'pace' | 'speed';
  paceMinutes: number;
  paceSeconds: number;
  speedKph: number;
  targetIntakePerHour: number;
  waterIntakePerHour: number;
  sodiumIntakePerHour: number;
  waterBagLiters: number;
  aidStations: AidStationFormItem[];
};

export const DEFAULT_PLAN_VALUES: PlanFormValues = {
  name: '',
  raceDistanceKm: 0,
  elevationGain: 0,
  paceType: 'pace',
  paceMinutes: 6,
  paceSeconds: 0,
  speedKph: 10,
  targetIntakePerHour: 70,
  waterIntakePerHour: 500,
  sodiumIntakePerHour: 600,
  waterBagLiters: 1.5,
  aidStations: [],
};

type Props = {
  initialValues: PlanFormValues;
  onSave: (values: PlanFormValues) => void;
  loading?: boolean;
  saveLabel?: string;
};

function NumberInput({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  style?: object;
}) {
  return (
    <TextInput
      style={[inputStyles.input, style]}
      value={value === 0 ? '' : String(value)}
      onChangeText={(t) => {
        const n = parseFloat(t.replace(',', '.'));
        onChange(isNaN(n) ? 0 : n);
      }}
      keyboardType="numeric"
      placeholder={placeholder ?? '0'}
      placeholderTextColor="#475569"
    />
  );
}

const inputStyles = StyleSheet.create({
  input: {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    flex: 1,
  },
});

export default function PlanForm({ initialValues, onSave, loading, saveLabel }: Props) {
  const [values, setValues] = useState<PlanFormValues>(initialValues);

  function update<K extends keyof PlanFormValues>(key: K, val: PlanFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function addAidStation() {
    const last = values.aidStations[values.aidStations.length - 1];
    const newStation: AidStationFormItem = {
      name: `Ravito ${values.aidStations.length + 1}`,
      distanceKm: last ? Math.min(last.distanceKm + 10, values.raceDistanceKm) : 10,
      waterRefill: true,
    };
    update('aidStations', [...values.aidStations, newStation]);
  }

  function updateAidStation(index: number, patch: Partial<AidStationFormItem>) {
    const updated = values.aidStations.map((s, i) => (i === index ? { ...s, ...patch } : s));
    update('aidStations', updated);
  }

  function removeAidStation(index: number) {
    update('aidStations', values.aidStations.filter((_, i) => i !== index));
  }

  function moveAidStation(index: number, direction: 'up' | 'down') {
    const arr = [...values.aidStations];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    update('aidStations', arr);
  }

  function handleSave() {
    if (!values.name.trim()) {
      Alert.alert('Champ requis', 'Le nom du plan est obligatoire.');
      return;
    }
    if (!values.raceDistanceKm || values.raceDistanceKm <= 0) {
      Alert.alert('Champ requis', 'La distance doit être supérieure à 0.');
      return;
    }
    onSave(values);
  }

  const waterBagOptions = [0.5, 1.0, 1.5, 2.0, 2.5];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Section Course */}
      <Text style={styles.sectionTitle}>Course</Text>

      <Text style={styles.label}>Nom du plan</Text>
      <TextInput
        style={styles.textInput}
        value={values.name}
        onChangeText={(t) => update('name', t)}
        placeholder="Ex : UTMB 2025"
        placeholderTextColor="#475569"
      />

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Distance (km)</Text>
          <NumberInput
            value={values.raceDistanceKm}
            onChange={(v) => update('raceDistanceKm', v)}
            placeholder="50"
          />
        </View>
        <View style={[styles.rowItem, { marginLeft: 12 }]}>
          <Text style={styles.label}>D+ (m)</Text>
          <NumberInput
            value={values.elevationGain}
            onChange={(v) => update('elevationGain', v)}
            placeholder="3000"
          />
        </View>
      </View>

      {/* Section Allure */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Allure</Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, values.paceType === 'pace' && styles.toggleBtnActive]}
          onPress={() => update('paceType', 'pace')}
        >
          <Text style={[styles.toggleBtnText, values.paceType === 'pace' && styles.toggleBtnTextActive]}>
            Allure (min/km)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, values.paceType === 'speed' && styles.toggleBtnActive]}
          onPress={() => update('paceType', 'speed')}
        >
          <Text style={[styles.toggleBtnText, values.paceType === 'speed' && styles.toggleBtnTextActive]}>
            Vitesse (km/h)
          </Text>
        </TouchableOpacity>
      </View>

      {values.paceType === 'pace' ? (
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Minutes</Text>
            <NumberInput
              value={values.paceMinutes}
              onChange={(v) => update('paceMinutes', Math.floor(v))}
              placeholder="6"
            />
          </View>
          <View style={[styles.rowItem, { marginLeft: 12 }]}>
            <Text style={styles.label}>Secondes</Text>
            <NumberInput
              value={values.paceSeconds}
              onChange={(v) => update('paceSeconds', Math.min(59, Math.floor(v)))}
              placeholder="30"
            />
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Vitesse (km/h)</Text>
          <NumberInput
            value={values.speedKph}
            onChange={(v) => update('speedKph', v)}
            placeholder="10"
          />
        </>
      )}

      {/* Section Nutrition */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Nutrition (cibles/heure)</Text>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Glucides (g/h)</Text>
          <NumberInput
            value={values.targetIntakePerHour}
            onChange={(v) => update('targetIntakePerHour', v)}
            placeholder="70"
          />
        </View>
        <View style={[styles.rowItem, { marginLeft: 12 }]}>
          <Text style={styles.label}>Eau (ml/h)</Text>
          <NumberInput
            value={values.waterIntakePerHour}
            onChange={(v) => update('waterIntakePerHour', v)}
            placeholder="500"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Sodium (mg/h)</Text>
          <NumberInput
            value={values.sodiumIntakePerHour}
            onChange={(v) => update('sodiumIntakePerHour', v)}
            placeholder="600"
          />
        </View>
        <View style={[styles.rowItem, { marginLeft: 12 }]} />
      </View>

      <Text style={styles.label}>Volume sac à eau</Text>
      <View style={styles.waterBagRow}>
        {waterBagOptions.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.waterBagBtn,
              values.waterBagLiters === opt && styles.waterBagBtnActive,
            ]}
            onPress={() => update('waterBagLiters', opt)}
          >
            <Text
              style={[
                styles.waterBagBtnText,
                values.waterBagLiters === opt && styles.waterBagBtnTextActive,
              ]}
            >
              {opt}L
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Section Ravitaillements */}
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>Ravitaillements</Text>
        <TouchableOpacity style={styles.addBtn} onPress={addAidStation}>
          <Text style={styles.addBtnText}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {values.aidStations.length === 0 && (
        <Text style={styles.emptyText}>Aucun ravito. Ajoutes-en un si ta course en a.</Text>
      )}

      {values.aidStations.map((station, index) => (
        <View key={index} style={styles.stationCard}>
          <View style={styles.stationHeader}>
            <View style={styles.stationOrderButtons}>
              <TouchableOpacity
                onPress={() => moveAidStation(index, 'up')}
                disabled={index === 0}
                style={[styles.orderBtn, index === 0 && styles.orderBtnDisabled]}
              >
                <Text style={styles.orderBtnText}>↑</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => moveAidStation(index, 'down')}
                disabled={index === values.aidStations.length - 1}
                style={[styles.orderBtn, index === values.aidStations.length - 1 && styles.orderBtnDisabled]}
              >
                <Text style={styles.orderBtnText}>↓</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.stationIndex}>#{index + 1}</Text>
            <TouchableOpacity onPress={() => removeAidStation(index)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={styles.textInput}
            value={station.name}
            onChangeText={(t) => updateAidStation(index, { name: t })}
            placeholder={`Ravito ${index + 1}`}
            placeholderTextColor="#475569"
          />

          <Text style={styles.label}>Distance (km)</Text>
          <NumberInput
            value={station.distanceKm}
            onChange={(v) => updateAidStation(index, { distanceKm: v })}
            placeholder="15"
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Eau disponible</Text>
            <Switch
              value={station.waterRefill}
              onValueChange={(v) => updateAidStation(index, { waterRefill: v })}
              trackColor={{ false: '#334155', true: '#14532d' }}
              thumbColor={station.waterRefill ? '#22c55e' : '#94a3b8'}
            />
          </View>
        </View>
      ))}

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.saveButtonText}>{saveLabel ?? 'Enregistrer'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  rowItem: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#334155',
  },
  toggleBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: '#f1f5f9',
  },
  waterBagRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  waterBagBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  waterBagBtnActive: {
    backgroundColor: '#14532d',
    borderColor: '#22c55e',
  },
  waterBagBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  waterBagBtnTextActive: {
    color: '#22c55e',
  },
  addBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addBtnText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: '#475569',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  stationCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stationOrderButtons: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 8,
  },
  orderBtn: {
    backgroundColor: '#334155',
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderBtnDisabled: {
    opacity: 0.3,
  },
  orderBtnText: {
    color: '#f1f5f9',
    fontSize: 14,
  },
  stationIndex: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#450a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  switchLabel: {
    color: '#f1f5f9',
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '700',
  },
});
