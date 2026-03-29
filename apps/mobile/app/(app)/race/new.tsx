import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../../lib/supabase';
import { useI18n } from '../../../lib/i18n';
import { Colors } from '../../../constants/colors';

type AidStation = { name: string; km: string; water: boolean };

export default function NewRaceScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [elevationGain, setElevationGain] = useState('');
  const [elevationLoss, setElevationLoss] = useState('');
  const [location, setLocation] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [aidStations, setAidStations] = useState<AidStation[]>([]);
  const [gpxContent, setGpxContent] = useState<string | null>(null);
  const [gpxFileName, setGpxFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePickGpx = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'application/xml', 'text/xml', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setGpxFileName(asset.name ?? 'route.gpx');

      const response = await fetch(asset.uri);
      const text = await response.text();
      setGpxContent(text);

      // Quick client-side parse for preview
      try {
        const eleValues = Array.from(text.matchAll(/<ele>([\d.]+)<\/ele>/g)).map((m) => parseFloat(m[1]));
        const trkpts = Array.from(text.matchAll(/<trkpt\s+lat="([\d.-]+)"\s+lon="([\d.-]+)"/g));

        let totalKm = 0;
        for (let i = 1; i < trkpts.length; i++) {
          const lat1 = parseFloat(trkpts[i - 1][1]);
          const lng1 = parseFloat(trkpts[i - 1][2]);
          const lat2 = parseFloat(trkpts[i][1]);
          const lng2 = parseFloat(trkpts[i][2]);
          const R = 6371;
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLng = ((lng2 - lng1) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
          totalKm += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        let gainM = 0;
        let lossM = 0;
        for (let i = 1; i < eleValues.length; i++) {
          const diff = eleValues[i] - eleValues[i - 1];
          if (diff > 0) gainM += diff;
          else lossM += Math.abs(diff);
        }

        if (totalKm > 0) setDistanceKm(String(Math.round(totalKm * 10) / 10));
        if (gainM > 0) setElevationGain(String(Math.round(gainM)));
        if (lossM > 0) setElevationLoss(String(Math.round(lossM)));
      } catch {
        // Preview failed silently
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de lire le fichier GPX.');
    }
  };

  const handleAddAidStation = () => {
    setAidStations((prev) => [...prev, { name: '', km: '', water: true }]);
  };

  const handleSave = async () => {
    if (!name.trim() || !distanceKm || !elevationGain) {
      Alert.alert('Champs requis', t.common.required);
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const userId = sessionData?.session?.user?.id;
      if (!token || !userId) {
        Alert.alert('Erreur', 'Session expirée.');
        return;
      }

      const slug =
        name.trim().toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '') +
        '-' +
        Date.now();

      const aid_stations = aidStations
        .filter((s) => s.name.trim() && parseFloat(s.km) >= 0)
        .map((s) => ({ name: s.name.trim(), distanceKm: parseFloat(s.km), waterRefill: s.water }));

      const payload: Record<string, unknown> = {
        name: name.trim(),
        distance_km: parseFloat(distanceKm),
        elevation_gain_m: parseFloat(elevationGain),
        elevation_loss_m: elevationLoss ? parseFloat(elevationLoss) : null,
        location_text: location.trim() || null,
        race_date: raceDate || null,
        aid_stations,
        gpx_content: gpxContent,
        is_public: false,
        is_live: false,
        is_published: false,
        event_id: null,
        created_by: userId,
        slug,
      };

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? ''}/api/races`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.race) {
        Alert.alert('Erreur', data?.message ?? t.races.createFailed);
        return;
      }

      // Ensure private fields are set regardless of server behaviour
      await supabase
        .from('races')
        .update({
          is_public: false,
          is_live: false,
          is_published: false,
          created_by: userId,
          slug,
          event_id: null,
        })
        .eq('id', data.race.id);

      Alert.alert('', t.races.created, [
        {
          text: t.plans.newPlanForRace.replace('+', '').trim(),
          onPress: () => router.replace({ pathname: '/(app)/plan/new', params: { raceId: data.race.id } }),
        },
        {
          text: t.common.back,
          onPress: () => router.back(),
        },
      ]);
    } catch {
      Alert.alert('Erreur', t.races.createFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>{t.races.createTitle}</Text>

      {/* GPX import */}
      <TouchableOpacity style={styles.gpxButton} onPress={handlePickGpx}>
        <Text style={styles.gpxButtonText}>
          {gpxFileName ? `📄 ${gpxFileName}` : `📂 ${t.races.gpxPickFile}`}
        </Text>
      </TouchableOpacity>

      {/* Name */}
      <Text style={styles.label}>{t.races.nameLabel}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t.races.namePlaceholder}
        placeholderTextColor={Colors.textMuted}
      />

      {/* Distance + Gain */}
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>{t.races.distanceLabel}</Text>
          <TextInput
            style={styles.input}
            value={distanceKm}
            onChangeText={setDistanceKm}
            keyboardType="decimal-pad"
            placeholder="50"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>{t.races.elevationGainLabel}</Text>
          <TextInput
            style={styles.input}
            value={elevationGain}
            onChangeText={setElevationGain}
            keyboardType="number-pad"
            placeholder="2200"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>

      {/* D- + Date */}
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>{t.races.elevationLossLabel}</Text>
          <TextInput
            style={styles.input}
            value={elevationLoss}
            onChangeText={setElevationLoss}
            keyboardType="number-pad"
            placeholder="2100"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>{t.races.dateLabel}</Text>
          <TextInput
            style={styles.input}
            value={raceDate}
            onChangeText={setRaceDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>

      {/* Location */}
      <Text style={styles.label}>{t.races.locationLabel}</Text>
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder={t.races.locationPlaceholder}
        placeholderTextColor={Colors.textMuted}
      />

      {/* Aid stations */}
      <View style={styles.aidHeader}>
        <Text style={styles.label}>{t.races.aidStationsLabel}</Text>
        <TouchableOpacity onPress={handleAddAidStation}>
          <Text style={styles.addLink}>{t.races.addAidStation}</Text>
        </TouchableOpacity>
      </View>
      {aidStations.map((s, i) => (
        <View key={i} style={styles.aidRow}>
          <TextInput
            style={[styles.input, styles.aidName]}
            value={s.name}
            onChangeText={(v) => setAidStations((prev) => prev.map((a, j) => j === i ? { ...a, name: v } : a))}
            placeholder={t.races.aidStationName}
            placeholderTextColor={Colors.textMuted}
          />
          <TextInput
            style={[styles.input, styles.aidKm]}
            value={s.km}
            onChangeText={(v) => setAidStations((prev) => prev.map((a, j) => j === i ? { ...a, km: v } : a))}
            keyboardType="decimal-pad"
            placeholder="km"
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity
            onPress={() => setAidStations((prev) => prev.filter((_, j) => j !== i))}
            style={styles.aidRemove}
          >
            <Text style={styles.aidRemoveText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={Colors.textOnBrand} />
        ) : (
          <Text style={styles.saveButtonText}>{t.common.create}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 60 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  gpxButton: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  gpxButtonText: { color: Colors.brandPrimary, fontSize: 14 },
  aidHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 4 },
  addLink: { color: Colors.brandPrimary, fontSize: 14, fontWeight: '600' },
  aidRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  aidName: { flex: 1 },
  aidKm: { width: 70 },
  aidRemove: { padding: 8 },
  aidRemoveText: { color: Colors.textSecondary, fontSize: 16 },
  saveButton: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: Colors.textOnBrand, fontSize: 16, fontWeight: '700' },
});
