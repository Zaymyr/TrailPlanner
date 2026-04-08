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
import { parseGpxForRaceImport, type MobileGpxParseResult } from '../../../lib/gpx';
import { Colors } from '../../../constants/colors';

type AidStation = { name: string; km: string; water: boolean };
type GpxFeedback = { tone: 'success' | 'warning'; message: string };
type FieldErrors = Partial<Record<'name' | 'distanceKm' | 'elevationGain' | 'elevationLoss' | 'raceDate' | 'aidStations', string>>;
type ValidatedRaceForm = {
  distanceKm: number;
  elevationGain: number;
  elevationLoss: number | null;
  aidStations: Array<{ name: string; distanceKm: number; waterRefill: boolean }>;
};

const parseNumberInput = (value: string): number | null => {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const FieldLabel = ({ label, required = false }: { label: string; required?: boolean }) => (
  <Text style={styles.label}>
    {label.replace(/\s*\*$/, '')}
    {required ? <Text style={styles.requiredMark}> *</Text> : null}
  </Text>
);

const FieldError = ({ message }: { message?: string }) => (
  message ? <Text style={styles.fieldError}>{message}</Text> : null
);

const buildGpxFeedback = (parsed: MobileGpxParseResult, t: ReturnType<typeof useI18n>['t']): GpxFeedback => {
  const base =
    parsed.pointSource === 'route'
      ? t.races.gpxRouteFallback
      : parsed.pointSource === 'waypoint'
        ? t.races.gpxWaypointFallback
      : t.races.gpxImportSuccess;
  const message = base
    .replace('{points}', String(parsed.pointCount))
    .replace('{distance}', String(parsed.stats.distanceKm));

  if (!parsed.hasElevation) {
    return { tone: 'warning', message: `${message} ${t.races.gpxNoElevation}` };
  }

  return {
    tone: parsed.pointSource === 'track' ? 'success' : 'warning',
    message,
  };
};

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
  const [gpxFeedback, setGpxFeedback] = useState<GpxFeedback | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = (): { ok: true; values: ValidatedRaceForm } | { ok: false; errors: FieldErrors } => {
    const errors: FieldErrors = {};
    const parsedDistance = parseNumberInput(distanceKm);
    const parsedGain = parseNumberInput(elevationGain);
    const parsedLoss = elevationLoss.trim() ? parseNumberInput(elevationLoss) : null;

    if (!name.trim()) {
      errors.name = t.races.validationNameRequired;
    }

    if (!distanceKm.trim()) {
      errors.distanceKm = t.races.validationDistanceRequired;
    } else if (parsedDistance === null || parsedDistance <= 0) {
      errors.distanceKm = t.races.validationDistancePositive;
    }

    if (!elevationGain.trim()) {
      errors.elevationGain = t.races.validationGainRequired;
    } else if (parsedGain === null || parsedGain < 0) {
      errors.elevationGain = t.races.validationGainNonNegative;
    }

    if (elevationLoss.trim() && (parsedLoss === null || parsedLoss < 0)) {
      errors.elevationLoss = t.races.validationLossNonNegative;
    }

    if (raceDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(raceDate.trim())) {
      errors.raceDate = t.races.validationDateFormat;
    }

    const validatedAidStations: ValidatedRaceForm['aidStations'] = [];

    for (let index = 0; index < aidStations.length; index += 1) {
      const station = aidStations[index];
      const stationName = station.name.trim();
      const hasName = stationName.length > 0;
      const hasKm = station.km.trim().length > 0;

      if (hasName !== hasKm) {
        errors.aidStations = t.races.validationAidStationIncomplete.replace('{index}', String(index + 1));
        break;
      }

      if (!hasName || !hasKm) continue;

      const stationKm = parseNumberInput(station.km);

      if (stationKm === null || stationKm < 0) {
        errors.aidStations = t.races.validationAidStationKm.replace('{index}', String(index + 1));
        break;
      }

      if (parsedDistance !== null && parsedDistance > 0 && stationKm > parsedDistance) {
        errors.aidStations = t.races.validationAidStationOutOfRange.replace('{index}', String(index + 1));
        break;
      }

      validatedAidStations.push({ name: stationName, distanceKm: stationKm, waterRefill: station.water });
    }

    if (Object.values(errors).some(Boolean) || parsedDistance === null || parsedGain === null) {
      return { ok: false, errors };
    }

    return {
      ok: true,
      values: {
        distanceKm: parsedDistance,
        elevationGain: parsedGain,
        elevationLoss: parsedLoss,
        aidStations: validatedAidStations,
      },
    };
  };

  const handlePickGpx = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'application/gpx', 'application/xml', 'text/xml', 'text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setGpxContent(null);
      setGpxFeedback(null);
      setGpxFileName(asset.name ?? 'route.gpx');

      const response = await fetch(asset.uri);
      const text = await response.text();
      setGpxContent(text);

      try {
        const parsed = parseGpxForRaceImport(text);

        if (parsed.stats.distanceKm > 0) {
          setDistanceKm(String(parsed.stats.distanceKm));
          clearFieldError('distanceKm');
        }
        if (parsed.hasElevation) {
          setElevationGain(String(Math.round(parsed.stats.gainM)));
          setElevationLoss(String(Math.round(parsed.stats.lossM)));
          clearFieldError('elevationGain');
          clearFieldError('elevationLoss');
        }

        setGpxFeedback(buildGpxFeedback(parsed, t));
      } catch {
        setGpxContent(null);
        setGpxFeedback({ tone: 'warning', message: t.races.gpxImportFailedDetails });
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de lire le fichier GPX.');
    }
  };

  const handleAddAidStation = () => {
    setAidStations((prev) => [...prev, { name: '', km: '', water: true }]);
  };

  const handleSave = async () => {
    const validation = validateForm();

    if (!validation.ok) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
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

      const aid_stations = validation.values.aidStations;

      const payload: Record<string, unknown> = {
        name: name.trim(),
        distance_km: validation.values.distanceKm,
        elevation_gain_m: validation.values.elevationGain,
        elevation_loss_m: validation.values.elevationLoss,
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
      {gpxFeedback ? (
        <View style={[styles.gpxFeedback, gpxFeedback.tone === 'warning' && styles.gpxFeedbackWarning]}>
          <Text style={styles.gpxFeedbackText}>{gpxFeedback.message}</Text>
        </View>
      ) : null}

      {/* Name */}
      <FieldLabel label={t.races.nameLabel} required />
      <TextInput
        style={[styles.input, fieldErrors.name && styles.inputError]}
        value={name}
        onChangeText={(value) => {
          setName(value);
          clearFieldError('name');
        }}
        placeholder={t.races.namePlaceholder}
        placeholderTextColor={Colors.textMuted}
      />
      <FieldError message={fieldErrors.name} />

      {/* Distance + Gain */}
      <View style={styles.row}>
        <View style={styles.col}>
          <FieldLabel label={t.races.distanceLabel} required />
          <TextInput
            style={[styles.input, fieldErrors.distanceKm && styles.inputError]}
            value={distanceKm}
            onChangeText={(value) => {
              setDistanceKm(value);
              clearFieldError('distanceKm');
            }}
            keyboardType="decimal-pad"
            placeholder="50"
            placeholderTextColor={Colors.textMuted}
          />
          <FieldError message={fieldErrors.distanceKm} />
        </View>
        <View style={styles.col}>
          <FieldLabel label={t.races.elevationGainLabel} required />
          <TextInput
            style={[styles.input, fieldErrors.elevationGain && styles.inputError]}
            value={elevationGain}
            onChangeText={(value) => {
              setElevationGain(value);
              clearFieldError('elevationGain');
            }}
            keyboardType="number-pad"
            placeholder="2200"
            placeholderTextColor={Colors.textMuted}
          />
          <FieldError message={fieldErrors.elevationGain} />
        </View>
      </View>

      {/* D- + Date */}
      <View style={styles.row}>
        <View style={styles.col}>
          <FieldLabel label={t.races.elevationLossLabel} />
          <TextInput
            style={[styles.input, fieldErrors.elevationLoss && styles.inputError]}
            value={elevationLoss}
            onChangeText={(value) => {
              setElevationLoss(value);
              clearFieldError('elevationLoss');
            }}
            keyboardType="number-pad"
            placeholder="2100"
            placeholderTextColor={Colors.textMuted}
          />
          <FieldError message={fieldErrors.elevationLoss} />
        </View>
        <View style={styles.col}>
          <FieldLabel label={t.races.dateLabel} />
          <TextInput
            style={[styles.input, fieldErrors.raceDate && styles.inputError]}
            value={raceDate}
            onChangeText={(value) => {
              setRaceDate(value);
              clearFieldError('raceDate');
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
          />
          <FieldError message={fieldErrors.raceDate} />
        </View>
      </View>

      {/* Location */}
      <FieldLabel label={t.races.locationLabel} />
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder={t.races.locationPlaceholder}
        placeholderTextColor={Colors.textMuted}
      />

      {/* Aid stations */}
      <View style={styles.aidHeader}>
        <FieldLabel label={t.races.aidStationsLabel} />
        <TouchableOpacity onPress={handleAddAidStation}>
          <Text style={styles.addLink}>{t.races.addAidStation}</Text>
        </TouchableOpacity>
      </View>
      {aidStations.map((s, i) => (
        <View key={i} style={styles.aidRow}>
          <TextInput
            style={[styles.input, styles.aidName]}
            value={s.name}
            onChangeText={(v) => {
              setAidStations((prev) => prev.map((a, j) => j === i ? { ...a, name: v } : a));
              clearFieldError('aidStations');
            }}
            placeholder={t.races.aidStationName}
            placeholderTextColor={Colors.textMuted}
          />
          <TextInput
            style={[styles.input, styles.aidKm]}
            value={s.km}
            onChangeText={(v) => {
              setAidStations((prev) => prev.map((a, j) => j === i ? { ...a, km: v } : a));
              clearFieldError('aidStations');
            }}
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
      <FieldError message={fieldErrors.aidStations} />

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
  requiredMark: { color: Colors.danger },
  fieldError: { color: Colors.danger, fontSize: 12, marginTop: 5 },
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
  inputError: { borderColor: Colors.danger },
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
  gpxFeedback: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  gpxFeedbackWarning: { borderColor: Colors.warning },
  gpxFeedbackText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
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
