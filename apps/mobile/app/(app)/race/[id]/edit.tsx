import { useEffect, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../../../../components/themed/Text';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { WEB_API_BASE_URL } from '../../../../lib/webApi';
import { useI18n } from '../../../../lib/i18n';
import { Colors } from '../../../../constants/colors';

export default function EditRaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [elevationGain, setElevationGain] = useState('');
  const [elevationLoss, setElevationLoss] = useState('');
  const [location, setLocation] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(app)/catalog');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);

      if (!id) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('races')
        .select('name, distance_km, elevation_gain_m, elevation_loss_m, location_text, created_by')
        .eq('id', id)
        .single();

      if (cancelled) return;

      if (error || !data) {
        Alert.alert('Erreur', 'Course introuvable.');
        router.back();
        return;
      }

      if (data.created_by !== uid) {
        Alert.alert('Interdit', 'Vous ne pouvez modifier que vos propres courses.');
        router.back();
        return;
      }

      setName(data.name ?? '');
      setDistanceKm(String(data.distance_km ?? ''));
      setElevationGain(String(data.elevation_gain_m ?? ''));
      setElevationLoss(data.elevation_loss_m != null ? String(data.elevation_loss_m) : '');
      setLocation(data.location_text ?? '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleSave = async () => {
    if (!name.trim() || !distanceKm || !elevationGain) {
      Alert.alert('Champs requis', t.common.required);
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { Alert.alert('Erreur', 'Session expirée.'); return; }

      const response = await fetch(`${WEB_API_BASE_URL}/api/races/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          distance_km: parseFloat(distanceKm),
          elevation_gain_m: parseFloat(elevationGain),
          elevation_loss_m: elevationLoss ? parseFloat(elevationLoss) : null,
          location_text: location.trim() || null,
          race_date: raceDate || null,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        Alert.alert('Erreur', data?.message ?? t.races.updateFailed);
        return;
      }

      Alert.alert('', t.races.updated);
      router.back();
    } catch {
      Alert.alert('Erreur', t.races.updateFailed);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerLeft: () => <BackButton onPress={handleBack} /> }} />
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <BackButton onPress={handleBack} /> }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>{t.races.editTitle}</Text>

      <Text style={styles.label}>{t.races.nameLabel}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t.races.namePlaceholder}
        placeholderTextColor="#475569"
      />

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>{t.races.distanceLabel}</Text>
          <TextInput
            style={styles.input}
            value={distanceKm}
            onChangeText={setDistanceKm}
            keyboardType="decimal-pad"
            inputAccessoryViewID="pace-yourself-numeric-keyboard"
            placeholderTextColor="#475569"
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>{t.races.elevationGainLabel}</Text>
          <TextInput
            style={styles.input}
            value={elevationGain}
            onChangeText={setElevationGain}
            keyboardType="number-pad"
            inputAccessoryViewID="pace-yourself-numeric-keyboard"
            placeholderTextColor="#475569"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>{t.races.elevationLossLabel}</Text>
          <TextInput
            style={styles.input}
            value={elevationLoss}
            onChangeText={setElevationLoss}
            keyboardType="number-pad"
            inputAccessoryViewID="pace-yourself-numeric-keyboard"
            placeholderTextColor="#475569"
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>{t.races.dateLabel}</Text>
          <TextInput
            style={styles.input}
            value={raceDate}
            onChangeText={setRaceDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#475569"
          />
        </View>
      </View>

      <Text style={styles.label}>{t.races.locationLabel}</Text>
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder={t.races.locationPlaceholder}
        placeholderTextColor="#475569"
      />

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.saveButtonText}>{t.common.save}</Text>
        )}
      </TouchableOpacity>
      </ScrollView>
    </>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();

  return (
    <TouchableOpacity
      accessibilityLabel={t.common.back}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={styles.headerBackButton}
    >
      <Ionicons color={Colors.textPrimary} name="chevron-back" size={28} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 60 },
  sectionTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  saveButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  headerBackButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
