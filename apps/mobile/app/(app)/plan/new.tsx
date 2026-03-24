import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import PlanForm, { PlanFormValues, DEFAULT_PLAN_VALUES } from '../../../components/PlanForm';

type CatalogRace = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
};

export default function NewPlanScreen() {
  const { catalogRaceId } = useLocalSearchParams<{ catalogRaceId?: string }>();
  const [initialValues, setInitialValues] = useState<PlanFormValues | null>(null);
  const [catalogRace, setCatalogRace] = useState<CatalogRace | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(!!catalogRaceId);
  const router = useRouter();

  useEffect(() => {
    if (!catalogRaceId) {
      setInitialValues(DEFAULT_PLAN_VALUES);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('races')
        .select('id, name, distance_km, elevation_gain_m')
        .eq('id', catalogRaceId)
        .single();

      if (cancelled) return;
      if (!error && data) {
        const race = data as CatalogRace;
        setCatalogRace(race);
        setInitialValues({
          ...DEFAULT_PLAN_VALUES,
          name: race.name,
          raceDistanceKm: race.distance_km,
          elevationGain: race.elevation_gain_m,
        });
      } else {
        setInitialValues(DEFAULT_PLAN_VALUES);
      }
      setLoadingCatalog(false);
    })();

    return () => { cancelled = true; };
  }, [catalogRaceId]);

  async function handleSave(values: PlanFormValues) {
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) {
      setSaving(false);
      return;
    }

    const plannerValues = {
      raceDistanceKm: values.raceDistanceKm,
      elevationGain: values.elevationGain,
      paceType: values.paceType,
      paceMinutes: values.paceMinutes,
      paceSeconds: values.paceSeconds,
      speedKph: values.speedKph,
      targetIntakePerHour: values.targetIntakePerHour,
      waterIntakePerHour: values.waterIntakePerHour,
      sodiumIntakePerHour: values.sodiumIntakePerHour,
      waterBagLiters: values.waterBagLiters,
      aidStations: values.aidStations.map((s, i) => ({
        name: s.name,
        distanceKm: s.distanceKm,
        waterRefill: s.waterRefill,
      })),
    };

    const { error } = await supabase.from('race_plans').insert({
      user_id: userId,
      name: values.name,
      planner_values: plannerValues,
      race_id: catalogRaceId ?? null,
    });

    setSaving(false);

    if (!error) {
      router.replace('/(app)/plans');
    }
  }

  if (loadingCatalog || !initialValues) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: catalogRace ? `Plan : ${catalogRace.name}` : 'Nouveau plan',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
        }}
      />
      <PlanForm
        initialValues={initialValues}
        onSave={handleSave}
        loading={saving}
        saveLabel="Créer le plan"
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
