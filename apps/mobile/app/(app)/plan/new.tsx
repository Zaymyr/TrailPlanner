import { useCallback, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../../components/themed/Text';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { DEFAULT_PLAN_VALUES, type PlanFormValues, type ElevationPoint } from '../../../components/PlanForm';
import { AppHeaderTitle } from '../../../components/navigation/AppHeaderTitle';
import { PremiumUpsellModal } from '../../../components/premium/PremiumUpsellModal';
import { PlanLoadingScreen } from '../../../components/PlanLoadingScreen';
import { RaceSelector } from '../../../components/RaceSelector';
import { Colors } from '../../../constants/colors';
import { useGuestAccountPrompt } from '../../../hooks/useGuestAccountPrompt';
import { usePremium } from '../../../hooks/usePremium';
import { useI18n } from '../../../lib/i18n';
import { ensureAppSession, isAnonymousSession } from '../../../lib/appSession';
import { noteReviewPlanCreated } from '../../../lib/appReview';
import { getCurrentUserPlanAccess } from '../../../lib/planAccess';
import { captureAnalyticsEvent } from '../../../lib/posthog';
import { fetchRaceAidStations, fetchRaceElevationProfile } from '../../../lib/raceProfile';
import { clearUnfinishedPlanReminder, syncUnfinishedPlanReminder } from '../../../lib/reminderNotifications';
import { supabase } from '../../../lib/supabase';
import { completeOnboarding } from '../../../lib/onboardingStatus';
import { parseRunnerProfile } from '../../../lib/runnerProfile';
import { rememberRunnerRace, clearPendingRunnerRace } from '../../../lib/runnerPlanIntent';

type RaceInfo = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
};

type UserPlanDefaultsProfile = {
  water_bag_liters?: number | null;
  comfortable_flat_pace_min_per_km?: number | null;
  default_carbs_g_per_hour?: number | null;
  default_water_ml_per_hour?: number | null;
  default_sodium_mg_per_hour?: number | null;
};

function buildDefaultPlanValues(profileDefaults: UserPlanDefaultsProfile | null | undefined): PlanFormValues {
  const nextValues: PlanFormValues = {
    ...DEFAULT_PLAN_VALUES,
  };

  const comfortableFlatPaceMinPerKm = profileDefaults?.comfortable_flat_pace_min_per_km;
  if (typeof profileDefaults?.water_bag_liters === 'number' && Number.isFinite(profileDefaults.water_bag_liters) && profileDefaults.water_bag_liters >= 0) nextValues.waterBagLiters = profileDefaults.water_bag_liters;
  if (
    typeof comfortableFlatPaceMinPerKm === 'number' &&
    Number.isFinite(comfortableFlatPaceMinPerKm) &&
    comfortableFlatPaceMinPerKm > 0
  ) {
    const totalSeconds = Math.round(comfortableFlatPaceMinPerKm * 60);
    nextValues.paceType = 'pace';
    nextValues.paceMinutes = Math.floor(totalSeconds / 60);
    nextValues.paceSeconds = totalSeconds % 60;
    nextValues.speedKph = Number((60 / comfortableFlatPaceMinPerKm).toFixed(1));
  }

  if (
    typeof profileDefaults?.default_carbs_g_per_hour === 'number' &&
    Number.isFinite(profileDefaults.default_carbs_g_per_hour) &&
    profileDefaults.default_carbs_g_per_hour >= 0
  ) {
    nextValues.targetIntakePerHour = profileDefaults.default_carbs_g_per_hour;
  }

  if (
    typeof profileDefaults?.default_water_ml_per_hour === 'number' &&
    Number.isFinite(profileDefaults.default_water_ml_per_hour) &&
    profileDefaults.default_water_ml_per_hour >= 0
  ) {
    nextValues.waterIntakePerHour = profileDefaults.default_water_ml_per_hour;
  }

  if (
    typeof profileDefaults?.default_sodium_mg_per_hour === 'number' &&
    Number.isFinite(profileDefaults.default_sodium_mg_per_hour) &&
    profileDefaults.default_sodium_mg_per_hour >= 0
  ) {
    nextValues.sodiumIntakePerHour = profileDefaults.default_sodium_mg_per_hour;
  }

  return nextValues;
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
      waterRefill: station.waterRefill !== false,
      solidRefill: station.solidRefill !== false,
      assistanceAllowed: station.assistanceAllowed !== false,
      pauseMinutes: station.pauseMinutes ?? 0,
      supplies: [],
    })),
  };
}

export default function NewPlanScreen() {
  const { raceId, catalogRaceId, onboarding } = useLocalSearchParams<{
    raceId?: string;
    catalogRaceId?: string;
    onboarding?: 'plan';
  }>();
  const resolvedRaceId = raceId ?? catalogRaceId ?? null;
  const planCreationSource = catalogRaceId ? 'catalog' : raceId ? 'preselected_race' : 'selector';
  const router = useRouter();
  const { t } = useI18n();
  const promptGuestAccount = useGuestAccountPrompt();
  const { isPremium, isLoading: premiumLoading } = usePremium();

  const [selectedRace, setSelectedRace] = useState<RaceInfo | null>(null);
  const [loading, setLoading] = useState(Boolean(resolvedRaceId));
  const [loadingPlanName, setLoadingPlanName] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0.08);
  const [showRaceSelector, setShowRaceSelector] = useState(!resolvedRaceId);
  const [showPremiumLimitModal, setShowPremiumLimitModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileStepVisible, setProfileStepVisible] = useState(false);
  const pendingProfilePlan = useRef<{ race: RaceInfo; values: PlanFormValues; elevation: ElevationPoint[] } | null>(null);
  const [profileDraft, setProfileDraft] = useState({ firstName: '', pace: '', water: '1.5', carbs: '60', birthDate: '', height: '', weight: '', utmb: '' });

  const createPlanDraft = useCallback(
    async (race: RaceInfo, seedValues: PlanFormValues, elevationProfile: ElevationPoint[]) => {
      setLoading(true);
      setLoadingPlanName(race.name);
      setLoadingProgress(0.9);

      const session = await ensureAppSession();
      const uid = session?.user?.id;

      if (!uid) {
        setLoading(false);
        router.replace('/(auth)/login');
        return;
      }

      // A plan is a personalized product. Guests may browse races, but must
      // create/sign into a real account before any durable plan is inserted.
      if (isAnonymousSession(session)) {
        await rememberRunnerRace(race.id);
        setLoading(false);
        setShowRaceSelector(false);
        promptGuestAccount({
          source: 'plan_creation',
          title: t.plans.guestLimitTitle,
          message: t.plans.guestLimitMessage,
        });
        return;
      }

      const profileResult = await supabase.from('user_profiles').select('full_name,birth_date,height_cm,weight_kg,water_bag_liters,utmb_index,comfortable_flat_pace_min_per_km,default_carbs_g_per_hour').eq('user_id', uid).maybeSingle();
      const profile = profileResult.data as Record<string, unknown> | null;
      const firstName = typeof profile?.full_name === 'string' ? profile.full_name.split(' ')[0] : '';
      const pace = typeof profile?.comfortable_flat_pace_min_per_km === 'number' ? String(profile.comfortable_flat_pace_min_per_km) : '';
      const water = typeof profile?.water_bag_liters === 'number' ? String(profile.water_bag_liters) : '';
      const carbs = typeof profile?.default_carbs_g_per_hour === 'number' ? String(profile.default_carbs_g_per_hour) : '';
      if (!firstName || !pace || !water || !carbs) {
        pendingProfilePlan.current = { race, values: seedValues, elevation: elevationProfile };
        setProfileDraft({ firstName, pace, water, carbs, birthDate: String(profile?.birth_date ?? ''), height: String(profile?.height_cm ?? ''), weight: String(profile?.weight_kg ?? ''), utmb: String(profile?.utmb_index ?? '') });
        setProfileStepVisible(true);
        setLoading(false);
        return;
      }

      const plannerValues = buildPlannerValues(seedValues);
      const { data, error } = await supabase
        .from('race_plans')
        .insert({
          user_id: uid,
          name: seedValues.name,
          planner_values: plannerValues,
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

      if (isAnonymousSession(session)) {
        await syncUnfinishedPlanReminder({
          planId: data.id,
          plannerValues,
          title: t.reminders.unfinishedPlanTitle,
          body: t.reminders.unfinishedPlanBody.replace('{name}', seedValues.name),
          href: `/(app)/plan/${data.id}/edit`,
          requestIfNeeded: true,
        });
      } else {
        await clearUnfinishedPlanReminder();
      }

      await noteReviewPlanCreated();
      captureAnalyticsEvent('plan created', {
        source: planCreationSource,
        aid_station_count: seedValues.aidStations.length,
        distance_km: race.distance_km,
        elevation_gain_m: race.elevation_gain_m,
      });
      if (onboarding === 'plan') {
        await completeOnboarding('plan');
        const { error: legacyOnboardingError } = await supabase
          .from('user_profiles')
          .update({ onboarding_completed_at: new Date().toISOString() })
          .eq('user_id', uid);
        if (legacyOnboardingError) {
          console.warn('Unable to update legacy onboarding completion marker', legacyOnboardingError);
        }
        await clearPendingRunnerRace();
        router.replace(`/(app)/plan/${data.id}/edit?showHelp=1`);
        return;
      }

      await clearPendingRunnerRace();
      router.replace(`/(app)/plan/${data.id}/edit`);
    },
    [
      onboarding,
      planCreationSource,
      promptGuestAccount,
      resolvedRaceId,
      router,
      t.common.error,
      t.plans.guestLimitMessage,
      t.plans.guestLimitTitle,
      t.reminders.unfinishedPlanBody,
      t.reminders.unfinishedPlanTitle,
    ],
  );

  const loadRaceSeed = useCallback(async () => {
    setLoading(true);
    setLoadingProgress(0.12);
    setLoadingPlanName(null);

      const session = await ensureAppSession();
      const uid = session?.user?.id ?? null;
      setUserId(uid);

    let defaultPlanValues = DEFAULT_PLAN_VALUES;
    if (uid) {
      const profileResult = await supabase
        .from('user_profiles')
        .select('water_bag_liters, comfortable_flat_pace_min_per_km, default_carbs_g_per_hour, default_water_ml_per_hour, default_sodium_mg_per_hour')
        .eq('user_id', uid)
        .maybeSingle();

      defaultPlanValues = buildDefaultPlanValues(profileResult.data as UserPlanDefaultsProfile | null);
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
          const planAccess = await getCurrentUserPlanAccess(false);
          if (!planAccess.hasReachedPlanLimit) {
            void loadRaceSeed();
            return;
          }

          if (planAccess.isAnonymous) {
            setLoading(false);
            setShowRaceSelector(false);
            setLoadingProgress(1);
            promptGuestAccount({
              source: 'plan_limit',
              title: t.plans.guestLimitTitle,
              message: t.plans.guestLimitMessage,
            });
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
    }, [
      isPremium,
      loadRaceSeed,
      premiumLoading,
      promptGuestAccount,
      resolvedRaceId,
      t.plans.guestLimitMessage,
      t.plans.guestLimitTitle,
    ]),
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
          .select('water_bag_liters, comfortable_flat_pace_min_per_km, default_carbs_g_per_hour, default_water_ml_per_hour, default_sodium_mg_per_hour')
          .eq('user_id', uid)
          .maybeSingle();

        defaultPlanValues = buildDefaultPlanValues(profileResult.data as UserPlanDefaultsProfile | null);
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

    return (
      <>
        <Stack.Screen
          options={{
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.textPrimary,
            headerShadowVisible: false,
            headerTitleAlign: 'left',
            headerTitle: () => <AppHeaderTitle title={t.plans.newPlan} />,
          }}
        />
        <PlanLoadingScreen
          planName={visiblePlanName}
          progress={loadingProgress}
          variant="create"
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          headerTitle: () => (
            <AppHeaderTitle
              title={selectedRace ? `${t.plans.newPlanForRace} ${selectedRace.name}` : t.plans.newPlan}
            />
          ),
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

      <Modal visible={profileStepVisible} transparent animationType="slide" onRequestClose={() => setProfileStepVisible(false)}>
        <View style={styles.profileBackdrop}>
          <ScrollView style={styles.profileCard} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            <Text style={styles.profileTitle}>Ton profil de course</Text>
            <Text style={styles.profileHint}>Ces informations personnalisent ton estimation.</Text>
            {([['firstName','Prénom *'],['pace','Allure confortable (min/km) *'],['water','Volume poche à eau (L) *'],['carbs','Cible glucidique (g/h) *'],['birthDate','Date de naissance'],['height','Taille (cm)'],['weight','Poids (kg)'],['utmb','Indice UTMB']] as const).map(([key,label]) => (
              <TextInput key={key} value={profileDraft[key]} onChangeText={(value) => setProfileDraft((current) => ({ ...current, [key]: value }))} placeholder={label} placeholderTextColor={Colors.textMuted} style={styles.profileInput} keyboardType={key === 'firstName' || key === 'birthDate' ? 'default' : 'decimal-pad'} />
            ))}
            <Pressable style={styles.profileButton} onPress={async () => {
              if (!profileDraft.firstName.trim() || !profileDraft.pace.trim() || !profileDraft.water.trim() || !profileDraft.carbs.trim() || !userId) { Alert.alert(t.common.error, 'Renseigne les champs obligatoires.'); return; }
              const profile = parseRunnerProfile(profileDraft);
              if (!profile) { Alert.alert(t.common.error, 'Vérifie les valeurs et la date de naissance (AAAA-MM-JJ).'); return; }
              const update = await supabase.from('user_profiles').update(profile).eq('user_id', userId);
              if (update.error) { Alert.alert(t.common.error, update.error.message); return; }
              setProfileStepVisible(false);
              const pending = pendingProfilePlan.current;
              pendingProfilePlan.current = null;
              if (pending) {
                const defaults = buildDefaultPlanValues(profile);
                void createPlanDraft(pending.race, { ...pending.values, paceType: defaults.paceType, paceMinutes: defaults.paceMinutes, paceSeconds: defaults.paceSeconds, speedKph: defaults.speedKph, waterBagLiters: profile.water_bag_liters, targetIntakePerHour: profile.default_carbs_g_per_hour }, pending.elevation);
              } else void loadRaceSeed();
            }}><Text style={styles.profileButtonText}>Continuer</Text></Pressable>
          </ScrollView>
        </View>
      </Modal>

      {showPremiumLimitModal ? (
        <PremiumUpsellModal
          visible={showPremiumLimitModal}
          title={t.plans.limitReachedTitle}
          message={t.plans.limitReachedMessage}
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
  profileBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  profileCard: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10 },
  profileTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700' },
  profileHint: { color: Colors.textSecondary, marginBottom: 4 },
  profileInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: Colors.textPrimary },
  profileButton: { backgroundColor: Colors.brandPrimary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  profileButtonText: { color: Colors.textOnBrand, fontWeight: '700' },
});
