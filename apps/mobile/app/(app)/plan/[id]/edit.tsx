import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../../lib/supabase';
import PlanForm, { PlanFormValues, DEFAULT_PLAN_VALUES, FavProduct, Supply, type ElevationPoint } from '../../../../components/PlanForm';
import { Colors } from '../../../../constants/colors';
import { fetchRaceElevationProfile } from '../../../../lib/raceProfile';
import { usePremium } from '../../../../hooks/usePremium';
import { getCurrentUserLatestAccessiblePlanId } from '../../../../lib/planAccess';
import { useI18n } from '../../../../lib/i18n';
import {
  clearActivePlanEditSession,
  clearPlanEditDraft,
  getPlanEditDraft,
  setActivePlanEditSession,
  setPlanEditDraft,
} from '../../../../lib/planEditSession';

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

function serializePlanValues(values: PlanFormValues): string {
  return JSON.stringify(values);
}

export default function EditPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const { t } = useI18n();
  const [initialValues, setInitialValues] = useState<PlanFormValues | null>(null);
  const [planName, setPlanName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [favoriteProducts, setFavoriteProducts] = useState<FavProduct[]>([]);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const latestDraftRef = useRef<PlanFormValues | null>(null);
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const elevationProfileRef = useRef<ElevationPoint[]>([]);
  const isSavingRef = useRef(false);
  const loadedPlanIdRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    elevationProfileRef.current = elevationProfile;
  }, [elevationProfile]);

  useEffect(() => {
    if (!id) return;

    setActivePlanEditSession(id);
  }, [id]);

  const loadPlan = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    const latestAccessiblePlanId = await getCurrentUserLatestAccessiblePlanId(isPremium);
    if (!isPremium && latestAccessiblePlanId && latestAccessiblePlanId !== id) {
      Alert.alert(t.plans.freeAccessTitle, t.plans.freeAccessMessage);
      clearActivePlanEditSession(id);
      clearPlanEditDraft(id);
      setInitialValues(null);
      setElevationProfile([]);
      setLoading(false);
      router.replace('/(app)/plans');
      return;
    }

    const cachedDraft = getPlanEditDraft(id);
    const sessionData = await supabase.auth.getSession();

    if (cachedDraft) {
      setPlanName(cachedDraft.planName);
      setInitialValues(cachedDraft.values);
      setElevationProfile(cachedDraft.elevationProfile);
      latestDraftRef.current = cachedDraft.values;
      lastSavedSnapshotRef.current = cachedDraft.lastSavedSnapshot;
      loadedPlanIdRef.current = id;
    } else {
      const planResult = await supabase
        .from('race_plans')
        .select('id, name, planner_values, elevation_profile, race_id')
        .eq('id', id)
        .single();

      if (planResult.error) {
        setError(planResult.error.message);
        setInitialValues(null);
        setElevationProfile([]);
        setLoading(false);
        return;
      }

      if (planResult.data) {
        const plan = planResult.data as RacePlanRow;
        const nextValues = planRowToFormValues(plan);
        const nextElevationProfile =
          Array.isArray(plan.elevation_profile) && plan.elevation_profile.length > 0
            ? plan.elevation_profile
            : await fetchRaceElevationProfile(plan.race_id ?? null);

        setPlanName(plan.name);
        setInitialValues(nextValues);
        setElevationProfile(nextElevationProfile);
        latestDraftRef.current = nextValues;
        lastSavedSnapshotRef.current = serializePlanValues(nextValues);
        loadedPlanIdRef.current = id;
      }
    }

    const uid = sessionData.data?.session?.user?.id;
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
            })),
        );
      }
    }

    setLoading(false);
  }, [id, isPremium, router, t.plans.freeAccessMessage, t.plans.freeAccessTitle]);

  const persistPlan = useCallback(
    async (values: PlanFormValues, silent = false) => {
      if (!id || isSavingRef.current) return false;

      isSavingRef.current = true;
      if (!silent) setSaving(true);

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
          elevation_profile: elevationProfileRef.current,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      isSavingRef.current = false;
      if (!silent) setSaving(false);

      if (!err) {
        setPlanName(values.name);
        latestDraftRef.current = values;
        lastSavedSnapshotRef.current = serializePlanValues(values);
        clearPlanEditDraft(id);
        return true;
      }

      return false;
    },
    [id],
  );

  useEffect(() => {
    if (premiumLoading || !id || loadedPlanIdRef.current === id) return;

    void loadPlan();
  }, [id, loadPlan, premiumLoading]);

  const leaveToPlans = useCallback(() => {
    clearActivePlanEditSession(id);
    if (id) {
      clearPlanEditDraft(id);
    }
    router.replace('/(app)/plans');
  }, [id, router]);

  const hasUnsavedChanges = useCallback(() => {
    const draft = latestDraftRef.current;
    const currentSnapshot = draft ? serializePlanValues(draft) : null;

    return (
      Boolean(draft) &&
      currentSnapshot !== null &&
      currentSnapshot !== lastSavedSnapshotRef.current
    );
  }, []);

  const saveAndLeaveToPlans = useCallback(async () => {
    const draft = latestDraftRef.current;

    if (!draft) {
      leaveToPlans();
      return;
    }

    const saved = await persistPlan(draft);

    if (saved) {
      clearActivePlanEditSession(id);
      router.replace('/(app)/plans');
      return;
    }

    Alert.alert(t.common.error, t.profile.saveFailed);
  }, [id, leaveToPlans, persistPlan, router, t.common.error, t.profile.saveFailed]);

  const handleBackToPlans = useCallback(() => {
    if (!hasUnsavedChanges()) {
      leaveToPlans();
      return;
    }

    Alert.alert(t.plans.editUnsavedTitle, t.plans.editUnsavedMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.plans.editUnsavedDiscard,
        style: 'destructive',
        onPress: leaveToPlans,
      },
      {
        text: t.plans.editUnsavedSaveAndLeave,
        onPress: () => {
          void saveAndLeaveToPlans();
        },
      },
    ]);
  }, [
    hasUnsavedChanges,
    leaveToPlans,
    saveAndLeaveToPlans,
    t.common.cancel,
    t.plans.editUnsavedDiscard,
    t.plans.editUnsavedMessage,
    t.plans.editUnsavedSaveAndLeave,
    t.plans.editUnsavedTitle,
  ]);

  async function handleSave(values: PlanFormValues) {
    latestDraftRef.current = values;
    await saveAndLeaveToPlans();
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
      <Stack.Screen
        options={{
          title: `Modifier : ${planName}`,
          headerLeft: () => (
            <TouchableOpacity
              accessibilityLabel={t.common.back}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={handleBackToPlans}
              style={styles.headerBackButton}
            >
              <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
            </TouchableOpacity>
          ),
        }}
      />
      <PlanForm
        key={id}
        initialValues={initialValues}
        elevationProfile={elevationProfile}
        onSave={handleSave}
        onValuesChange={(values) => {
          latestDraftRef.current = values;
          if (id) {
            setPlanEditDraft(id, {
              elevationProfile: elevationProfileRef.current,
              lastSavedSnapshot: lastSavedSnapshotRef.current,
              planName: values.name || planName,
              values,
            });
          }
        }}
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
  headerBackButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
