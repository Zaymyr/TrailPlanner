import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import PlanForm, { PlanFormValues, DEFAULT_PLAN_VALUES } from '../../../components/PlanForm';
import { RaceSelector } from '../../../components/RaceSelector';
import { useI18n } from '../../../lib/i18n';

type RaceInfo = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
};

export default function NewPlanScreen() {
  const { raceId, catalogRaceId } = useLocalSearchParams<{ raceId?: string; catalogRaceId?: string }>();
  const resolvedRaceId = raceId ?? catalogRaceId ?? null;
  const { t } = useI18n();

  const [selectedRace, setSelectedRace] = useState<RaceInfo | null>(null);
  const [initialValues, setInitialValues] = useState<PlanFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!resolvedRaceId);
  const [showRaceSelector, setShowRaceSelector] = useState(!resolvedRaceId);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data?.session?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!resolvedRaceId) {
      setInitialValues(DEFAULT_PLAN_VALUES);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('races')
        .select('id, name, distance_km, elevation_gain_m')
        .eq('id', resolvedRaceId)
        .single();

      if (cancelled) return;
      if (!error && data) {
        const race = data as RaceInfo;
        setSelectedRace(race);
        setInitialValues({
          ...DEFAULT_PLAN_VALUES,
          name: race.name,
          raceDistanceKm: race.distance_km,
          elevationGain: race.elevation_gain_m,
        });
      } else {
        setInitialValues(DEFAULT_PLAN_VALUES);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [resolvedRaceId]);

  function handleRaceSelected(race: { id: string; name: string; distance_km: number; elevation_gain_m: number }) {
    setSelectedRace(race);
    setInitialValues({
      ...DEFAULT_PLAN_VALUES,
      name: race.name,
      raceDistanceKm: race.distance_km,
      elevationGain: race.elevation_gain_m,
    });
    setShowRaceSelector(false);
  }

  async function handleSave(values: PlanFormValues) {
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) {
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
      aidStations: values.aidStations.map((s) => ({
        name: s.name,
        distanceKm: s.distanceKm,
        waterRefill: s.waterRefill,
      })),
    };

    const { error } = await supabase.from('race_plans').insert({
      user_id: uid,
      name: values.name,
      planner_values: plannerValues,
      race_id: selectedRace?.id ?? resolvedRaceId ?? null,
    });

    setSaving(false);

    if (!error) {
      router.replace('/(app)/plans');
    }
  }

  if (loading) {
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
          title: selectedRace ? `${t.plans.newPlanForRace} ${selectedRace.name}` : t.plans.newPlan,
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
        }}
      />

      <RaceSelector
        visible={showRaceSelector}
        onClose={() => {
          if (!selectedRace) {
            router.back();
          } else {
            setShowRaceSelector(false);
          }
        }}
        onSelect={handleRaceSelected}
        userId={userId}
      />

      {!showRaceSelector && initialValues && (
        <PlanForm
          initialValues={initialValues}
          onSave={handleSave}
          loading={saving}
          saveLabel={t.common.create}
        />
      )}
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
