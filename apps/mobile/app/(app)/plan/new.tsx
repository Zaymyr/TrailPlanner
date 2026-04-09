import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constants/colors';
import PlanForm, { PlanFormValues, DEFAULT_PLAN_VALUES, type ElevationPoint } from '../../../components/PlanForm';
import { PlanLoadingScreen } from '../../../components/PlanLoadingScreen';
import { RaceSelector } from '../../../components/RaceSelector';
import { useI18n } from '../../../lib/i18n';
import { fetchRaceAidStations, fetchRaceElevationProfile } from '../../../lib/raceProfile';
import { usePremium } from '../../../hooks/usePremium';
import { currentUserHasReachedFreePlanLimit, FREE_PLAN_LIMIT } from '../../../lib/planAccess';
import { PremiumUpsellModal } from '../../../components/premium/PremiumUpsellModal';
import { loadPlanProductsBootstrap, type PlanProductsBootstrap } from '../../../components/plan-form/usePlanProducts';

type RaceInfo = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
};

function buildDefaultPlanValues(comfortableFlatPaceMinPerKm: number | null | undefined): PlanFormValues {
  if (
    typeof comfortableFlatPaceMinPerKm !== 'number' ||
    !Number.isFinite(comfortableFlatPaceMinPerKm) ||
    comfortableFlatPaceMinPerKm <= 0
  ) {
    return DEFAULT_PLAN_VALUES;
  }

  const totalSeconds = Math.round(comfortableFlatPaceMinPerKm * 60);
  const paceMinutes = Math.floor(totalSeconds / 60);
  const paceSeconds = totalSeconds % 60;

  return {
    ...DEFAULT_PLAN_VALUES,
    paceType: 'pace',
    paceMinutes,
    paceSeconds,
    speedKph: Number((60 / comfortableFlatPaceMinPerKm).toFixed(1)),
  };
}

export default function NewPlanScreen() {
  const { raceId, catalogRaceId } = useLocalSearchParams<{ raceId?: string; catalogRaceId?: string }>();
  const resolvedRaceId = raceId ?? catalogRaceId ?? null;
  const { t } = useI18n();
  const { isPremium, isLoading: premiumLoading } = usePremium();

  const [selectedRace, setSelectedRace] = useState<RaceInfo | null>(null);
  const [initialValues, setInitialValues] = useState<PlanFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!resolvedRaceId);
  const [loadingPlanName, setLoadingPlanName] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0.08);
  const [showRaceSelector, setShowRaceSelector] = useState(!resolvedRaceId);
  const [userId, setUserId] = useState<string | null>(null);
  const [defaultPlanValues, setDefaultPlanValues] = useState<PlanFormValues>(DEFAULT_PLAN_VALUES);
  const [planProductData, setPlanProductData] = useState<PlanProductsBootstrap | null>(null);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const [showPremiumLimitModal, setShowPremiumLimitModal] = useState(false);
  const router = useRouter();

  const loadRaceSeed = useCallback(async () => {
    setLoadingProgress(0.12);
    setLoadingPlanName(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id ?? null;
    setUserId(uid);
    let nextDefaultPlanValues = DEFAULT_PLAN_VALUES;
    if (uid) {
      const profileResult = await supabase
        .from('user_profiles')
        .select('comfortable_flat_pace_min_per_km')
        .eq('user_id', uid)
        .maybeSingle();
      nextDefaultPlanValues = buildDefaultPlanValues(
        (profileResult.data as { comfortable_flat_pace_min_per_km?: number | null } | null)
          ?.comfortable_flat_pace_min_per_km ?? null,
      );
    }
    setDefaultPlanValues(nextDefaultPlanValues);
    const productDataPromise = loadPlanProductsBootstrap(uid);

    if (!resolvedRaceId) {
      setLoadingProgress(0.48);
      setPlanProductData(await productDataPromise);
      setLoadingProgress(0.9);
      setSelectedRace(null);
      setLoading(false);
      setShowRaceSelector(true);
      setElevationProfile([]);
      setInitialValues(nextDefaultPlanValues);
      return;
    }

    setLoading(true);
    setLoadingProgress(0.24);
    const raceResultPromise = supabase
      .from('races')
      .select('id, name, distance_km, elevation_gain_m')
      .eq('id', resolvedRaceId)
      .single();
    const elevationProfilePromise = fetchRaceElevationProfile(resolvedRaceId);
    const aidStationsPromise = fetchRaceAidStations(resolvedRaceId);
    const { data, error } = await raceResultPromise;

    if (!error && data) {
      setLoadingPlanName((data as RaceInfo).name);
      setLoadingProgress(0.52);
    }

    const [fetchedElevationProfile, fetchedAidStations, nextProductData] = await Promise.all([
      elevationProfilePromise,
      aidStationsPromise,
      productDataPromise,
    ]);
    setPlanProductData(nextProductData);
    setLoadingProgress(0.82);

    if (!error && data) {
      const race = data as RaceInfo;
      setSelectedRace(race);
      setShowRaceSelector(false);
      setElevationProfile(fetchedElevationProfile);
      setInitialValues({
        ...nextDefaultPlanValues,
        name: race.name,
        raceDistanceKm: race.distance_km,
        elevationGain: race.elevation_gain_m,
        aidStations: fetchedAidStations,
      });
    } else {
      setSelectedRace(null);
      setElevationProfile([]);
      setInitialValues(nextDefaultPlanValues);
    }
    setLoadingProgress(1);
    setLoading(false);
  }, [resolvedRaceId]);

  useFocusEffect(
    useCallback(() => {
      if (premiumLoading) return undefined;

      if (!isPremium) {
        void (async () => {
          const reachedLimit = await currentUserHasReachedFreePlanLimit();
          if (!reachedLimit) {
            void loadRaceSeed();
            return;
          }

          setLoading(false);
          setShowRaceSelector(false);
          setShowPremiumLimitModal(true);
          setPlanProductData(null);
          setLoadingProgress(1);
        })();

        return () => {
          setSelectedRace(null);
          setElevationProfile([]);
          setPlanProductData(null);
          setInitialValues(null);
          setLoadingPlanName(null);
          setLoadingProgress(0.08);
          setDefaultPlanValues(DEFAULT_PLAN_VALUES);
          setLoading(!!resolvedRaceId);
          setShowRaceSelector(!resolvedRaceId);
        };
      }

      void loadRaceSeed();

      return () => {
        setSelectedRace(null);
        setElevationProfile([]);
        setPlanProductData(null);
        setInitialValues(null);
        setLoadingPlanName(null);
        setLoadingProgress(0.08);
        setDefaultPlanValues(DEFAULT_PLAN_VALUES);
        setLoading(!!resolvedRaceId);
        setShowRaceSelector(!resolvedRaceId);
      };
    }, [isPremium, loadRaceSeed, premiumLoading, resolvedRaceId]),
  );

  async function handleRaceSelected(race: { id: string; name: string; distance_km: number; elevation_gain_m: number }) {
    setLoading(true);
    setLoadingPlanName(race.name);
    setLoadingProgress(0.22);
    setSelectedRace(race);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id ?? userId;
    setUserId(uid);
    setLoadingProgress(0.42);
    const [nextElevationProfile, nextAidStations, nextProductData] = await Promise.all([
      fetchRaceElevationProfile(race.id),
      fetchRaceAidStations(race.id),
      planProductData ? Promise.resolve(planProductData) : loadPlanProductsBootstrap(uid),
    ]);
    setLoadingProgress(0.82);
    setPlanProductData(nextProductData);
    setElevationProfile(nextElevationProfile);
    setInitialValues({
      ...defaultPlanValues,
      name: race.name,
      raceDistanceKm: race.distance_km,
      elevationGain: race.elevation_gain_m,
      aidStations: nextAidStations,
    });
    setShowRaceSelector(false);
    setLoadingProgress(1);
    setLoading(false);
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
        pauseMinutes: s.pauseMinutes ?? 0,
        supplies: (s.supplies ?? []).map((sup) => ({ productId: sup.productId, quantity: sup.quantity })),
      })),
    };

    const { data, error } = await supabase
      .from('race_plans')
      .insert({
        user_id: uid,
        name: values.name,
        planner_values: plannerValues,
        elevation_profile: elevationProfile,
        race_id: selectedRace?.id ?? resolvedRaceId ?? null,
      })
      .select('id')
      .single();

    setSaving(false);

    if (!error && data?.id) {
      router.replace(`/(app)/plan/${data.id}/edit`);
    }
  }

  if (loading || premiumLoading || (!showRaceSelector && initialValues && !planProductData)) {
    const visiblePlanName = loadingPlanName ?? selectedRace?.name ?? initialValues?.name ?? null;
    const loadingTitle = visiblePlanName
      ? t.plans.planLoadingNamed.replace('{name}', visiblePlanName)
      : t.plans.planLoadingGeneric;

    return (
      <PlanLoadingScreen
        planName={visiblePlanName}
        progress={loadingProgress}
        stage={t.plans.planLoadingStage}
        title={loadingTitle}
      />
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

      {!isPremium ? (
        <View style={styles.limitInfo}>
          <Text style={styles.limitInfoText}>
            {t.plans.limitReachedMessage.replace('{count}', String(FREE_PLAN_LIMIT))}
          </Text>
        </View>
      ) : null}

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

      {!showRaceSelector && initialValues && planProductData && (
        <PlanForm
          key={selectedRace?.id ?? resolvedRaceId ?? 'new-plan'}
          initialValues={initialValues}
          elevationProfile={elevationProfile}
          onSave={handleSave}
          isPremium={isPremium}
          loading={saving}
          saveLabel={t.common.create}
          productData={planProductData}
        />
      )}

      {showPremiumLimitModal ? (
        <PremiumUpsellModal
          visible={showPremiumLimitModal}
          title={t.plans.limitReachedTitle}
          message={t.plans.limitReachedMessage.replace('{count}', String(FREE_PLAN_LIMIT))}
          onClose={() => {
            setShowPremiumLimitModal(false);
            router.replace('/(app)/plans');
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  limitInfo: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.warning,
    backgroundColor: Colors.warningSurface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  limitInfoText: {
    color: Colors.warning,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
