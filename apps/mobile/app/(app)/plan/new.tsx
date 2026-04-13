import { useCallback, useState } from 'react';
import { Alert, Text, View, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { DEFAULT_PLAN_VALUES, type PlanFormValues, type ElevationPoint } from '../../../components/PlanForm';
import { PremiumUpsellModal } from '../../../components/premium/PremiumUpsellModal';
import { PlanLoadingScreen } from '../../../components/PlanLoadingScreen';
import { RaceSelector } from '../../../components/RaceSelector';
import { Colors } from '../../../constants/colors';
import { usePremium } from '../../../hooks/usePremium';
import { useI18n } from '../../../lib/i18n';
import { noteReviewPlanCreated } from '../../../lib/appReview';
import { currentUserHasReachedFreePlanLimit, FREE_PLAN_LIMIT } from '../../../lib/planAccess';
import { fetchRaceAidStations, fetchRaceElevationProfile } from '../../../lib/raceProfile';
import { supabase } from '../../../lib/supabase';

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

function buildPlannerValues(values: PlanFormValues) {
  return {
    raceDistanceKm: values.raceDistanceKm,
    elevationGain: values.elevationGain,
    fatigueLevel: values.fatigueLevel,
    paceType: values.paceType,
    paceMinutes: values.paceMinutes,
    paceSeconds: values.paceSeconds,
    speedKph: values.speedKph,
    targetIntakePerHour: values.targetIntakePerHour,
    waterIntakePerHour: values.waterIntakePerHour,
    sodiumIntakePerHour: values.sodiumIntakePerHour,
    waterBagLiters: values.waterBagLiters,
    startSupplies: [],
    segments: values.sectionSegments,
    sectionSegments: values.sectionSegments,
    aidStations: values.aidStations.map((station) => ({
      name: station.name,
      distanceKm: station.distanceKm,
      waterRefill: station.waterRefill,
      pauseMinutes: station.pauseMinutes ?? 0,
      supplies: [],
    })),
  };
}

export default function NewPlanScreen() {
  const { raceId, catalogRaceId } = useLocalSearchParams<{ raceId?: string; catalogRaceId?: string }>();
  const resolvedRaceId = raceId ?? catalogRaceId ?? null;
  const router = useRouter();
  const { t } = useI18n();
  const { isPremium, isLoading: premiumLoading } = usePremium();

  const [selectedRace, setSelectedRace] = useState<RaceInfo | null>(null);
  const [loading, setLoading] = useState(Boolean(resolvedRaceId));
  const [loadingPlanName, setLoadingPlanName] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0.08);
  const [showRaceSelector, setShowRaceSelector] = useState(!resolvedRaceId);
  const [showPremiumLimitModal, setShowPremiumLimitModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const createPlanDraft = useCallback(
    async (race: RaceInfo, seedValues: PlanFormValues, elevationProfile: ElevationPoint[]) => {
      setLoading(true);
      setLoadingPlanName(race.name);
      setLoadingProgress(0.9);

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;

      if (!uid) {
        setLoading(false);
        router.replace('/(auth)/login');
        return;
      }

      const { data, error } = await supabase
        .from('race_plans')
        .insert({
          user_id: uid,
          name: seedValues.name,
          planner_values: buildPlannerValues(seedValues),
          elevation_profile: elevationProfile,
          race_id: race.id,
        })
        .select('id')
        .single();

      if (error || !data?.id) {
        setLoading(false);
        setLoadingProgress(0.08);
        setShowRaceSelector(!resolvedRaceId);
        Alert.alert(t.common.error, error?.message ?? t.common.error);
        return;
      }

      await noteReviewPlanCreated();
      router.replace(`/(app)/plan/${data.id}/edit`);
    },
    [resolvedRaceId, router, t.common.error],
  );

  const loadRaceSeed = useCallback(async () => {
    setLoading(true);
    setLoadingProgress(0.12);
    setLoadingPlanName(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id ?? null;
    setUserId(uid);

    let defaultPlanValues = DEFAULT_PLAN_VALUES;
    if (uid) {
      const profileResult = await supabase
        .from('user_profiles')
        .select('comfortable_flat_pace_min_per_km')
        .eq('user_id', uid)
        .maybeSingle();

      defaultPlanValues = buildDefaultPlanValues(
        (profileResult.data as { comfortable_flat_pace_min_per_km?: number | null } | null)
          ?.comfortable_flat_pace_min_per_km ?? null,
      );
    }

    if (!resolvedRaceId) {
      setSelectedRace(null);
      setLoading(false);
      setLoadingProgress(0.9);
      setShowRaceSelector(true);
      return;
    }

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

    const [elevationProfile, aidStations] = await Promise.all([elevationProfilePromise, aidStationsPromise]);
    setLoadingProgress(0.82);

    if (!error && data) {
      const race = data as RaceInfo;
      setSelectedRace(race);
      setShowRaceSelector(false);

      await createPlanDraft(
        race,
        {
          ...defaultPlanValues,
          name: race.name,
          raceDistanceKm: race.distance_km,
          elevationGain: race.elevation_gain_m,
          aidStations,
        },
        elevationProfile,
      );
      return;
    }

    setSelectedRace(null);
    setLoading(false);
    setShowRaceSelector(true);
  }, [createPlanDraft, resolvedRaceId]);

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
          setLoadingProgress(1);
        })();

        return () => {
          setSelectedRace(null);
          setLoadingPlanName(null);
          setLoadingProgress(0.08);
          setLoading(Boolean(resolvedRaceId));
          setShowRaceSelector(!resolvedRaceId);
        };
      }

      void loadRaceSeed();

      return () => {
        setSelectedRace(null);
        setLoadingPlanName(null);
        setLoadingProgress(0.08);
        setLoading(Boolean(resolvedRaceId));
        setShowRaceSelector(!resolvedRaceId);
      };
    }, [isPremium, loadRaceSeed, premiumLoading, resolvedRaceId]),
  );

  const handleRaceSelected = useCallback(
    async (race: RaceInfo) => {
      setLoading(true);
      setLoadingPlanName(race.name);
      setLoadingProgress(0.22);
      setSelectedRace(race);
      setShowRaceSelector(false);

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id ?? userId;
      setUserId(uid);

      let defaultPlanValues = DEFAULT_PLAN_VALUES;
      if (uid) {
        const profileResult = await supabase
          .from('user_profiles')
          .select('comfortable_flat_pace_min_per_km')
          .eq('user_id', uid)
          .maybeSingle();

        defaultPlanValues = buildDefaultPlanValues(
          (profileResult.data as { comfortable_flat_pace_min_per_km?: number | null } | null)
            ?.comfortable_flat_pace_min_per_km ?? null,
        );
      }

      setLoadingProgress(0.42);
      const [elevationProfile, aidStations] = await Promise.all([
        fetchRaceElevationProfile(race.id),
        fetchRaceAidStations(race.id),
      ]);
      setLoadingProgress(0.82);

      await createPlanDraft(
        race,
        {
          ...defaultPlanValues,
          name: race.name,
          raceDistanceKm: race.distance_km,
          elevationGain: race.elevation_gain_m,
          aidStations,
        },
        elevationProfile,
      );
    },
    [createPlanDraft, userId],
  );

  if (loading || premiumLoading) {
    const visiblePlanName = loadingPlanName ?? selectedRace?.name ?? null;
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
