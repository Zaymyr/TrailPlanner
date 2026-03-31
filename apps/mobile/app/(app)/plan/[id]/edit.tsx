import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import PlanForm, { PlanFormValues, DEFAULT_PLAN_VALUES, FavProduct, Supply, type ElevationPoint } from '../../../../components/PlanForm';
import { Colors } from '../../../../constants/colors';
import { fetchRaceElevationProfile } from '../../../../lib/raceProfile';

type RacePlanRow = {
  id: string;
  name: string;
  race_id?: string | null;
  elevation_profile?: ElevationPoint[];
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
    startSupplies?: Array<{ productId: string; quantity: number }>;
    segments?: Record<string, any[]>;
    sectionSegments?: Record<string, any[]>;
    aidStations?: Array<{
      name: string;
      distanceKm: number;
      waterRefill: boolean;
      pauseMinutes?: number;
      supplies?: Array<{ productId: string; quantity: number }>;
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
    startSupplies: (pv.startSupplies ?? []).map((s): Supply => ({ productId: s.productId, quantity: s.quantity ?? 1 })),
    sectionSegments: (pv.sectionSegments ?? pv.segments) as PlanFormValues['sectionSegments'],
    aidStations: (pv.aidStations ?? []).map((s) => ({
      name: s.name,
      distanceKm: s.distanceKm,
      waterRefill: s.waterRefill,
      pauseMinutes: s.pauseMinutes ?? 0,
      supplies: (s.supplies ?? []).map((sup): Supply => ({ productId: sup.productId, quantity: sup.quantity ?? 1 })),
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
  const [favoriteProducts, setFavoriteProducts] = useState<FavProduct[]>([]);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const [planResult, sessionData] = await Promise.all([
        supabase.from('race_plans').select('id, name, planner_values, elevation_profile, race_id').eq('id', id).single(),
        supabase.auth.getSession(),
      ]);

      if (cancelled) return;

      if (planResult.error) {
        setError(planResult.error.message);
      } else if (planResult.data) {
        const plan = planResult.data as RacePlanRow;
        setPlanName(plan.name);
        setInitialValues(planRowToFormValues(plan));
        if (Array.isArray(plan.elevation_profile) && plan.elevation_profile.length > 0) {
          setElevationProfile(plan.elevation_profile);
        } else {
          setElevationProfile(await fetchRaceElevationProfile(plan.race_id ?? null));
        }
      }

      const uid = sessionData.data?.session?.user?.id;
      if (uid) {
        const { data: favsData } = await supabase
          .from('user_favorite_products')
          .select('products(id, name, carbs_g, sodium_mg)')
          .eq('user_id', uid);
        if (!cancelled && favsData) {
          setFavoriteProducts(
            (favsData as any[])
              .map((row) => row.products)
              .filter(Boolean)
              .map((p: any) => ({
                id: p.id,
                name: p.name,
                carbsGrams: p.carbs_g ?? 0,
                sodiumMg: p.sodium_mg ?? 0,
              }))
          );
        }
      }

      if (!cancelled) setLoading(false);
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
      startSupplies: (values.startSupplies ?? []).map((s) => ({ productId: s.productId, quantity: s.quantity })),
      segments: values.sectionSegments,
      sectionSegments: values.sectionSegments,
      aidStations: values.aidStations.map((s) => ({
        name: s.name,
        distanceKm: s.distanceKm,
        waterRefill: s.waterRefill,
        pauseMinutes: s.pauseMinutes ?? 0,
        supplies: (s.supplies ?? []).map((sup) => ({ productId: sup.productId, quantity: sup.quantity })),
      })),
    };

    const { error: err } = await supabase
      .from('race_plans')
      .update({
        name: values.name,
        planner_values: plannerValues,
        elevation_profile: elevationProfile,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    setSaving(false);

    if (!err) {
      setPlanName(values.name);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brandPrimary} size="large" />
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
      <Stack.Screen options={{ title: `Modifier : ${planName}` }} />
      <PlanForm
        initialValues={initialValues}
        elevationProfile={elevationProfile}
        onSave={handleSave}
        loading={saving}
        saveLabel="Enregistrer les modifications"
        favoriteProducts={favoriteProducts}
        compactBasicsByDefault
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 15,
    textAlign: 'center',
  },
});
