import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constants/colors';
import PlanForm, { PlanFormValues, DEFAULT_PLAN_VALUES, FavProduct, type ElevationPoint } from '../../../components/PlanForm';
import { RaceSelector } from '../../../components/RaceSelector';
import { useI18n } from '../../../lib/i18n';
import { fetchRaceElevationProfile } from '../../../lib/raceProfile';

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
  const [favoriteProducts, setFavoriteProducts] = useState<FavProduct[]>([]);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data?.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: favsData } = await supabase
          .from('user_favorite_products')
          .select('products(id, name, carbs_g, sodium_mg)')
          .eq('user_id', uid);
        if (favsData) {
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
    })();
  }, []);

  useEffect(() => {
    if (!resolvedRaceId) {
      setElevationProfile([]);
      setInitialValues(DEFAULT_PLAN_VALUES);
      return;
    }

    let cancelled = false;
    (async () => {
      const [{ data, error }, fetchedElevationProfile] = await Promise.all([
        supabase
          .from('races')
          .select('id, name, distance_km, elevation_gain_m')
          .eq('id', resolvedRaceId)
          .single(),
        fetchRaceElevationProfile(resolvedRaceId),
      ]);

      if (cancelled) return;
      if (!error && data) {
        const race = data as RaceInfo;
        setSelectedRace(race);
        setElevationProfile(fetchedElevationProfile);
        setInitialValues({
          ...DEFAULT_PLAN_VALUES,
          name: race.name,
          raceDistanceKm: race.distance_km,
          elevationGain: race.elevation_gain_m,
        });
      } else {
        setElevationProfile([]);
        setInitialValues(DEFAULT_PLAN_VALUES);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [resolvedRaceId]);

  async function handleRaceSelected(race: { id: string; name: string; distance_km: number; elevation_gain_m: number }) {
    setSelectedRace(race);
    setElevationProfile(await fetchRaceElevationProfile(race.id));
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
      startSupplies: (values.startSupplies ?? []).map((s) => ({ productId: s.productId, quantity: s.quantity })),
      segments: values.sectionSegments,
      sectionSegments: values.sectionSegments,
      aidStations: values.aidStations.map((s) => ({
        name: s.name,
        distanceKm: s.distanceKm,
        waterRefill: s.waterRefill,
        supplies: (s.supplies ?? []).map((sup) => ({ productId: sup.productId, quantity: sup.quantity })),
      })),
    };

    const { error } = await supabase.from('race_plans').insert({
      user_id: uid,
      name: values.name,
      planner_values: plannerValues,
      elevation_profile: elevationProfile,
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
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerShadowVisible: false,
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
          elevationProfile={elevationProfile}
          onSave={handleSave}
          loading={saving}
          saveLabel={t.common.create}
          favoriteProducts={favoriteProducts}
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
    backgroundColor: Colors.background,
  },
});
