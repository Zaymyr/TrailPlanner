import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import PlanForm, { PlanFormValues, DEFAULT_PLAN_VALUES } from '../../../../components/PlanForm';

type RacePlanRow = {
  id: string;
  name: string;
  planner_values: {
    raceDistanceKm?: number;
    elevationGain?: number;
    paceType?: 'pace' | 'speed';
    paceMinutes?: number;
    paceSeconds?: number;
    speedKph?: number;
    targetIntakePerHour?: number;
    waterIntakePerHour?: number;
    sodiumIntakePerHour?: number;
    waterBagLiters?: number;
    aidStations?: Array<{
      name: string;
      distanceKm: number;
      waterRefill: boolean;
    }>;
  };
};

function planRowToFormValues(plan: RacePlanRow): PlanFormValues {
  const pv = plan.planner_values ?? {};
  return {
    name: plan.name,
    raceDistanceKm: pv.raceDistanceKm ?? 0,
    elevationGain: pv.elevationGain ?? 0,
    paceType: pv.paceType ?? 'pace',
    paceMinutes: pv.paceMinutes ?? 6,
    paceSeconds: pv.paceSeconds ?? 0,
    speedKph: pv.speedKph ?? 10,
    targetIntakePerHour: pv.targetIntakePerHour ?? 70,
    waterIntakePerHour: pv.waterIntakePerHour ?? 500,
    sodiumIntakePerHour: pv.sodiumIntakePerHour ?? 600,
    waterBagLiters: pv.waterBagLiters ?? 1.5,
    aidStations: (pv.aidStations ?? []).map((s) => ({
      name: s.name,
      distanceKm: s.distanceKm,
      waterRefill: s.waterRefill,
    })),
  };
}

export default function EditPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initialValues, setInitialValues] = useState<PlanFormValues | null>(null);
  const [planName, setPlanName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const { data, error: err } = await supabase
        .from('race_plans')
        .select('id, name, planner_values')
        .eq('id', id)
        .single();

      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else if (data) {
        const plan = data as RacePlanRow;
        setPlanName(plan.name);
        setInitialValues(planRowToFormValues(plan));
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [id]);

  async function handleSave(values: PlanFormValues) {
    setSaving(true);

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

    const { error: err } = await supabase
      .from('race_plans')
      .update({
        name: values.name,
        planner_values: plannerValues,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    setSaving(false);

    if (!err) {
      router.back();
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  if (error || !initialValues) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Plan introuvable.'}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `Modifier : ${planName}`,
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
        }}
      />
      <PlanForm
        initialValues={initialValues}
        onSave={handleSave}
        loading={saving}
        saveLabel="Enregistrer les modifications"
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
    padding: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    textAlign: 'center',
  },
});
