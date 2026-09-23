import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  AppState,
  Share
} from 'react-native';
import { Text } from '../../../../components/themed/Text';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../../../lib/supabase';
import { AppHeaderTitle } from '../../../../components/navigation/AppHeaderTitle';
import PlanForm, { PlanFormValues, Supply, type ElevationPoint } from '../../../../components/PlanForm';
import type { PlanProduct } from '../../../../components/plan-form/contracts';
import { FeedbackHeaderButton } from '../../../../components/feedback/FeedbackHeaderButton';
import { HelpHeaderButton } from '../../../../components/help/HelpHeaderButton';
import { SpotlightTutorial } from '../../../../components/help/SpotlightTutorial';
import { PlanLoadingScreen } from '../../../../components/PlanLoadingScreen';
import { Colors } from '../../../../constants/colors';
import { type PlanEditTutorialTargetKey, usePlanEditTutorial } from '../../../../hooks/usePlanEditTutorial';
import { fetchRaceElevationProfile, pickBestElevationProfile } from '../../../../lib/raceProfile';
import { type TutorialStep } from '../../../../lib/helpTutorial';
import { usePremium } from '../../../../hooks/usePremium';
import { FREE_PLAN_LIMIT, getCurrentUserPlanAccess } from '../../../../lib/planAccess';
import { noteReviewPlanSaved } from '../../../../lib/appReview';
import { isAnonymousSession } from '../../../../lib/appSession';
import { useI18n } from '../../../../lib/i18n';
import { captureAnalyticsEvent } from '../../../../lib/posthog';
import { clearUnfinishedPlanReminder, syncUnfinishedPlanReminder } from '../../../../lib/reminderNotifications';
import { loadPlanProductsBootstrap, type PlanProductsBootstrap } from '../../../../components/plan-form/usePlanProducts';
import {
  clearActivePlanEditSession,
  clearPlanEditDraft,
  clearPendingPlanEditHelp,
  clearPlanEditProductsBootstrap,
  getPendingPlanEditHelp,
  getPlanEditDraft,
  getPlanEditProductsBootstrap,
  setActivePlanEditSession,
  setPlanEditDraft
} from '../../../../lib/planEditSession';
import { clearPendingOnboardingTransition } from '../../../../lib/onboardingTransition';
import {
  applyStoredDepartureTime,
  buildPlanSummary,
  buildProductMap as buildSummaryProductMap,
  buildStoredRacePlanFromValues,
  collectPlanProductIdsFromValues,
  getPlanSummaryDepartureTimeStorageKey,
} from '../../../../lib/planSummary';
import { createPlanShareLink } from '../../../../lib/planShareLinks';
import {
  buildPersistedPlannerValues,
  createPlanPersistenceSnapshot,
  getIntermediateAidStationCount,
  normalizePlanValuesForPersistence,
} from '../../../../lib/planPersistence';

type RacePlanRow = {
  id: string;
  name: string;
  race_id?: string | null;
  elevation_profile?: ElevationPoint[];
  planner_values: {
    raceDistanceKm?: number;
    elevationGain?: number;
    fatigueLevel?: number;
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
      solidRefill?: boolean;
      assistanceAllowed?: boolean;
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
    fatigueLevel:
      typeof pv.fatigueLevel === 'number' && Number.isFinite(pv.fatigueLevel)
        ? Math.min(1, Math.max(0, pv.fatigueLevel))
        : 0.5,
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
      waterRefill: s.waterRefill !== false,
      solidRefill: s.solidRefill !== false,
      assistanceAllowed: s.assistanceAllowed !== false,
      pauseMinutes: s.pauseMinutes ?? 0,
      supplies:
        s.assistanceAllowed === false
          ? []
          : (s.supplies ?? []).map((sup): Supply => ({ productId: sup.productId, quantity: sup.quantity ?? 1 })),
    })),
  };
}

function serializePlanValues(values: PlanFormValues, elevationProfile: readonly ElevationPoint[]): string {
  return createPlanPersistenceSnapshot(values, elevationProfile);
}

function getUnsavedPlanEditDraft(planId: string) {
  const draft = getPlanEditDraft(planId);
  if (!draft) return null;

  return serializePlanValues(draft.values, draft.elevationProfile) === draft.lastSavedSnapshot
    ? null
    : draft;
}

const PLAN_AUTOSAVE_DELAY_MS = 1600;

async function loadProductMapForPlanValues(values: PlanFormValues) {
  const productIds = collectPlanProductIdsFromValues(values);
  if (productIds.length === 0) return {};

  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, fuel_type, carbs_g, sodium_mg, calories_kcal')
    .in('id', productIds);

  if (error) throw error;

  return buildSummaryProductMap((data ?? []) as PlanProduct[]);
}

export default function EditPlanScreen() {
  const { id, showHelp } = useLocalSearchParams<{ id: string; showHelp?: string }>();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const { locale, t } = useI18n();
  const initialWarmStartDraft = id ? getUnsavedPlanEditDraft(id) : null;
  const initialWarmStartProductData = id ? getPlanEditProductsBootstrap(id) : null;
  const hasInitialWarmStart = Boolean(initialWarmStartDraft && initialWarmStartProductData);
  const tutorialSteps = useMemo<TutorialStep<PlanEditTutorialTargetKey>[]>(
    () => [
      {
        screenKey: 'planEdit',
        targetKey: 'basics',
        title: t.helpTutorial.planEdit.basicsTitle,
        body: t.helpTutorial.planEdit.basicsBody,
        highlightPadding: 8,
        highlightRadius: 16,
        placement: 'bottom',
      },
      {
        screenKey: 'planEdit',
        targetKey: 'summary',
        title: t.helpTutorial.planEdit.summaryTitle,
        body: t.helpTutorial.planEdit.summaryBody,
        highlightPadding: 8,
        highlightRadius: 16,
      },
      {
        screenKey: 'planEdit',
        targetKey: 'views',
        title: t.helpTutorial.planEdit.viewsTitle,
        body: t.helpTutorial.planEdit.viewsBody,
        highlightPadding: 8,
        highlightRadius: 16,
      },
      {
        screenKey: 'planEdit',
        targetKey: 'autoFill',
        title: t.helpTutorial.planEdit.autoFillTitle,
        body: t.helpTutorial.planEdit.autoFillBody,
        highlightPadding: 8,
        highlightRadius: 18,
      },
      {
        screenKey: 'planEdit',
        targetKey: 'aidStations',
        title: t.helpTutorial.planEdit.aidStationsTitle,
        body: t.helpTutorial.planEdit.aidStationsBody,
        highlightPadding: 8,
        highlightRadius: 18,
        placement: 'top',
      },
    ],
    [t.helpTutorial],
  );
  const [initialValues, setInitialValues] = useState<PlanFormValues | null>(
    () => initialWarmStartDraft?.values ?? null,
  );
  const [planName, setPlanName] = useState(() => initialWarmStartDraft?.planName ?? '');
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(() =>
    hasInitialWarmStart ? (id ?? null) : null,
  );
  const [loadingPlanName, setLoadingPlanName] = useState<string | null>(
    () => initialWarmStartDraft?.planName ?? null,
  );
  const [loadingPlanNameId, setLoadingPlanNameId] = useState<string | null>(() =>
    hasInitialWarmStart ? (id ?? null) : null,
  );
  const [loadingProgress, setLoadingProgress] = useState(() => (hasInitialWarmStart ? 1 : 0.08));
  const [loading, setLoading] = useState(() => !hasInitialWarmStart);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draftSnapshot, setDraftSnapshot] = useState<string | null>(() =>
    initialWarmStartDraft
      ? serializePlanValues(initialWarmStartDraft.values, initialWarmStartDraft.elevationProfile)
      : null,
  );
  const [planProductData, setPlanProductData] = useState<PlanProductsBootstrap | null>(
    () => initialWarmStartProductData ?? null,
  );
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>(
    () => initialWarmStartDraft?.elevationProfile ?? [],
  );
  const latestDraftRef = useRef<PlanFormValues | null>(initialWarmStartDraft?.values ?? null);
  const lastSavedSnapshotRef = useRef<string | null>(initialWarmStartDraft?.lastSavedSnapshot ?? null);
  const elevationProfileRef = useRef<ElevationPoint[]>(initialWarmStartDraft?.elevationProfile ?? []);
  const hasAutoOpenedHelpRef = useRef(false);
  const isSavingRef = useRef(false);
  const activeSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const loadedPlanIdRef = useRef<string | null>(hasInitialWarmStart ? (id ?? null) : null);
  const activeRouteIdRef = useRef<string | null>(id ?? null);
  const loadRequestIdRef = useRef(0);
  const router = useRouter();
  const {
    handleTutorialClose,
    handleTutorialNext,
    handleTutorialPrevious,
    handleTutorialScrollEvent,
    handleTutorialScrollSettled,
    openTutorial,
    registerTutorialTarget,
    registerTutorialTargetRef,
    rootRef,
    scrollRef,
    setTutorialContentHeight,
    setTutorialViewport,
    tutorialStepIndex,
    tutorialTargetRect,
    tutorialViewport,
    tutorialVisible,
  } = usePlanEditTutorial({ steps: tutorialSteps });

  useEffect(() => {
    elevationProfileRef.current = elevationProfile;
    const currentDraft = latestDraftRef.current;
    if (!currentDraft) return;

    const nextSnapshot = serializePlanValues(currentDraft, elevationProfile);
    setDraftSnapshot(nextSnapshot);

    if (!id) return;
    if (nextSnapshot === lastSavedSnapshotRef.current) {
      clearPlanEditDraft(id);
      return;
    }

    setPlanEditDraft(id, {
      elevationProfile,
      lastSavedSnapshot: lastSavedSnapshotRef.current,
      planName: currentDraft.name || planName,
      values: currentDraft,
    });
  }, [elevationProfile, id, planName]);

  useEffect(() => {
    const shouldAutoOpenHelp =
      showHelp === '1' || (id ? getPendingPlanEditHelp() === id : false);

    if (
      !shouldAutoOpenHelp ||
      !initialValues ||
      tutorialViewport.height <= 0 ||
      hasAutoOpenedHelpRef.current
    ) {
      return;
    }

    hasAutoOpenedHelpRef.current = true;
    const timeoutId = setTimeout(() => {
      if (id) {
        clearPendingPlanEditHelp(id);
      }
      openTutorial();
    }, 550);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [id, initialValues, openTutorial, showHelp, tutorialViewport.height]);

  useEffect(() => {
    if (!id) return;
    clearPendingOnboardingTransition();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const cachedDraft = getUnsavedPlanEditDraft(id);
    const cachedProductData = getPlanEditProductsBootstrap(id);

    activeRouteIdRef.current = id;
    loadRequestIdRef.current += 1;
    latestDraftRef.current = null;
    lastSavedSnapshotRef.current = null;
    elevationProfileRef.current = [];
    isSavingRef.current = false;
    activeSavePromiseRef.current = null;
    setError(null);
    setSaving(false);
    setSaveStatus('idle');
    setActivePlanEditSession(id);

    if (cachedDraft && cachedProductData) {
      loadedPlanIdRef.current = id;
      latestDraftRef.current = cachedDraft.values;
      lastSavedSnapshotRef.current = cachedDraft.lastSavedSnapshot;
      elevationProfileRef.current = cachedDraft.elevationProfile;
      setLoadedPlanId(id);
      setInitialValues(cachedDraft.values);
      setPlanName(cachedDraft.planName);
      setLoadingPlanName(cachedDraft.planName);
      setLoadingPlanNameId(id);
      setLoadingProgress(1);
      setLoading(false);
      setDraftSnapshot(serializePlanValues(cachedDraft.values, cachedDraft.elevationProfile));
      setPlanProductData(cachedProductData);
      setElevationProfile(cachedDraft.elevationProfile);
      clearPlanEditProductsBootstrap(id);
      return;
    }

    loadedPlanIdRef.current = null;
    setLoadedPlanId(null);
    setInitialValues(null);
    setPlanName('');
    setLoadingPlanName(null);
    setLoadingPlanNameId(id);
    setLoadingProgress(0.08);
    setLoading(true);
    setDraftSnapshot(null);
    setPlanProductData(null);
    setElevationProfile([]);
  }, [id]);

  const loadPlan = useCallback(async () => {
    if (!id) return;
    const loadRequestId = ++loadRequestIdRef.current;
    activeRouteIdRef.current = id;
    const isStaleLoad = () => loadRequestIdRef.current !== loadRequestId || activeRouteIdRef.current !== id;

    setLoading(true);
    setError(null);
    setLoadingProgress(0.12);
    setLoadingPlanName(null);
    setLoadingPlanNameId(id);

    const planAccess = await getCurrentUserPlanAccess(isPremium);
    if (isStaleLoad()) return;

    setLoadingProgress(0.26);
    if (
      !isPremium &&
      planAccess.accessiblePlanIds !== null &&
      !planAccess.accessiblePlanIds.has(id)
    ) {
      Alert.alert(
        t.plans.freeAccessTitle,
        t.plans.freeAccessMessage.replace('{count}', String(FREE_PLAN_LIMIT)),
      );
      clearActivePlanEditSession(id);
      clearPlanEditDraft(id);
      setInitialValues(null);
      setElevationProfile([]);
      setPlanProductData(null);
      loadedPlanIdRef.current = null;
      setLoadedPlanId(null);
      setLoadingProgress(1);
      setLoading(false);
      router.replace('/(app)/plans');
      return;
    }

    const cachedDraft = getUnsavedPlanEditDraft(id);
    const sessionData = await supabase.auth.getSession();
    if (isStaleLoad()) return;

    const uid = sessionData.data?.session?.user?.id ?? null;
    const productDataPromise = loadPlanProductsBootstrap(uid);

    if (cachedDraft) {
      setLoadingProgress(0.48);
      setLoadingPlanName(cachedDraft.planName);
      setLoadingPlanNameId(id);
      setPlanName(cachedDraft.planName);
      setInitialValues(cachedDraft.values);
      setElevationProfile(cachedDraft.elevationProfile);
      latestDraftRef.current = cachedDraft.values;
      lastSavedSnapshotRef.current = cachedDraft.lastSavedSnapshot;
      setDraftSnapshot(serializePlanValues(cachedDraft.values, cachedDraft.elevationProfile));
    } else {
      setLoadingProgress(0.38);
      const planResult = await supabase
        .from('race_plans')
        .select('id, name, planner_values, elevation_profile, race_id')
        .eq('id', id)
        .single();
      if (isStaleLoad()) return;

      if (planResult.error) {
        setError(planResult.error.message);
        setInitialValues(null);
        setElevationProfile([]);
        setPlanProductData(null);
        loadedPlanIdRef.current = null;
        setLoadedPlanId(null);
        setLoadingProgress(1);
        setLoading(false);
        setSaveStatus('error');
        return;
      }

      if (planResult.data) {
        const plan = planResult.data as RacePlanRow;
        setLoadingPlanName(plan.name);
        setLoadingPlanNameId(id);
        setLoadingProgress(0.56);
        const nextValues = planRowToFormValues(plan);
        const storedPlanElevationProfile = Array.isArray(plan.elevation_profile) ? plan.elevation_profile : [];
        const fetchedRaceElevationProfile = plan.race_id ? await fetchRaceElevationProfile(plan.race_id) : [];
        const nextElevationProfile = pickBestElevationProfile(
          [storedPlanElevationProfile, fetchedRaceElevationProfile],
          nextValues.raceDistanceKm,
        );
        if (isStaleLoad()) return;

        setLoadingProgress(0.72);

        setPlanName(plan.name);
        setInitialValues(nextValues);
        setElevationProfile(nextElevationProfile);
        latestDraftRef.current = nextValues;
        lastSavedSnapshotRef.current = serializePlanValues(nextValues, storedPlanElevationProfile);
        setDraftSnapshot(serializePlanValues(nextValues, nextElevationProfile));
      }
    }

    setLoadingProgress(0.86);
    const nextProductData = await productDataPromise;
    if (isStaleLoad()) return;

    setPlanProductData(nextProductData);
    loadedPlanIdRef.current = id;
    setLoadedPlanId(id);
    setLoadingProgress(1);

    setLoading(false);
    const currentDraft = latestDraftRef.current;
    setSaveStatus(
      currentDraft &&
        serializePlanValues(currentDraft, elevationProfileRef.current) === lastSavedSnapshotRef.current
        ? 'saved'
        : 'idle',
    );
  }, [id, isPremium, router, t.plans.freeAccessMessage, t.plans.freeAccessTitle]);

  const persistPlan = useCallback(
    (values: PlanFormValues, silent = false) => {
      if (!id) return Promise.resolve(false);
      if (activeSavePromiseRef.current) return activeSavePromiseRef.current;

      isSavingRef.current = true;
      setSaveStatus('saving');
      if (!silent) setSaving(true);
      const savedSnapshot = serializePlanValues(values, elevationProfileRef.current);
      const normalizedValues = normalizePlanValuesForPersistence(values);
      const plannerValues = buildPersistedPlannerValues(normalizedValues);

      const savePromise = (async () => {
        const { data: updatedPlan, error: err } = await supabase
          .from('race_plans')
          .update({
            name: normalizedValues.name,
            planner_values: plannerValues,
            elevation_profile: elevationProfileRef.current,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('id')
          .maybeSingle();

        if (!err && updatedPlan?.id === id) {
          lastSavedSnapshotRef.current = savedSnapshot;

          const latestDraft = latestDraftRef.current;
          const latestSnapshot = latestDraft
            ? serializePlanValues(latestDraft, elevationProfileRef.current)
            : null;

          if (latestSnapshot === savedSnapshot) {
            setPlanName(normalizedValues.name);
            clearPlanEditDraft(id);
          } else if (latestDraft) {
            setPlanEditDraft(id, {
              elevationProfile: elevationProfileRef.current,
              lastSavedSnapshot: savedSnapshot,
              planName: latestDraft.name || normalizedValues.name,
              values: latestDraft,
            });
          }

          try {
            const sessionData = await supabase.auth.getSession();
            if (isAnonymousSession(sessionData.data?.session)) {
              await syncUnfinishedPlanReminder({
                planId: id,
                plannerValues,
                title: t.reminders.unfinishedPlanTitle,
                body: t.reminders.unfinishedPlanBody.replace('{name}', normalizedValues.name),
                href: `/(app)/plan/${id}/edit`,
                requestIfNeeded: !silent,
              });
            } else {
              await clearUnfinishedPlanReminder(id);
            }
          } catch {
            // The durable plan save succeeded; reminder scheduling is best effort.
          }

          const currentSnapshot = latestDraftRef.current
            ? serializePlanValues(latestDraftRef.current, elevationProfileRef.current)
            : savedSnapshot;
          setSaveStatus(currentSnapshot === savedSnapshot ? 'saved' : 'idle');
          return true;
        }

        setSaveStatus('error');
        return false;
      })().catch(() => {
        setSaveStatus('error');
        return false;
      }).finally(() => {
        isSavingRef.current = false;
        if (!silent) setSaving(false);
        activeSavePromiseRef.current = null;
      });

      activeSavePromiseRef.current = savePromise;
      return savePromise;
    },
    [id, t.reminders.unfinishedPlanBody, t.reminders.unfinishedPlanTitle],
  );

  const saveLatestDraft = useCallback(
    async (silent = false) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const draft = latestDraftRef.current;
        const snapshot = draft ? serializePlanValues(draft, elevationProfileRef.current) : null;

        if (!draft || snapshot === lastSavedSnapshotRef.current) {
          return true;
        }

        const saved = await persistPlan(draft, silent && attempt === 0);
        if (!saved) {
          return false;
        }
      }

      const finalDraft = latestDraftRef.current;
      const finalSnapshot = finalDraft
        ? serializePlanValues(finalDraft, elevationProfileRef.current)
        : null;
      return finalSnapshot === lastSavedSnapshotRef.current;
    },
    [persistPlan],
  );

  useEffect(() => {
    if (premiumLoading || !id || loadedPlanIdRef.current === id) return;

    void loadPlan();
  }, [id, loadPlan, premiumLoading]);

  useEffect(() => {
    if (!id || premiumLoading || loading || loadedPlanId !== id || !draftSnapshot) return;
    if (draftSnapshot === lastSavedSnapshotRef.current) return;

    const autosaveTimer = setTimeout(() => {
      void saveLatestDraft(true);
    }, PLAN_AUTOSAVE_DELAY_MS);

    return () => clearTimeout(autosaveTimer);
  }, [draftSnapshot, id, loadedPlanId, loading, premiumLoading, saveLatestDraft]);

  useEffect(() => {
    if (!id) return undefined;

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        void saveLatestDraft(true);
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [id, saveLatestDraft]);

  const leaveToPlans = useCallback(() => {
    clearActivePlanEditSession(id);
    if (id) {
      clearPlanEditDraft(id);
    }
    router.replace('/(app)/plans');
  }, [id, router]);

  const hasUnsavedChanges = useCallback(() => {
    const draft = latestDraftRef.current;
    const currentSnapshot = draft
      ? serializePlanValues(draft, elevationProfileRef.current)
      : null;

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

    const saved = await saveLatestDraft(false);

    if (saved) {
      await noteReviewPlanSaved();
      captureAnalyticsEvent('plan saved', {
        aid_station_count: getIntermediateAidStationCount(draft.aidStations),
        segment_count: draft.sectionSegments?.length ?? 0,
      });
      clearActivePlanEditSession(id);
      router.replace('/(app)/plans');
      return;
    }

    Alert.alert(t.common.error, t.profile.saveFailed);
  }, [id, leaveToPlans, router, saveLatestDraft, t.common.error, t.profile.saveFailed]);

  const promptUnsavedChanges = useCallback(() => {
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
    leaveToPlans,
    saveAndLeaveToPlans,
    t.common.cancel,
    t.plans.editUnsavedDiscard,
    t.plans.editUnsavedMessage,
    t.plans.editUnsavedSaveAndLeave,
    t.plans.editUnsavedTitle,
  ]);

  const handleBackToPlans = useCallback(() => {
    if (!hasUnsavedChanges()) {
      leaveToPlans();
      return;
    }

    void (async () => {
      const saved = await saveLatestDraft(true);
      if (saved || !hasUnsavedChanges()) {
        leaveToPlans();
        return;
      }

      promptUnsavedChanges();
    })();
  }, [hasUnsavedChanges, leaveToPlans, promptUnsavedChanges, saveLatestDraft]);

  async function handleSave(values: PlanFormValues) {
    const normalizedValues = normalizePlanValuesForPersistence(values);
    latestDraftRef.current = normalizedValues;
    setDraftSnapshot(serializePlanValues(normalizedValues, elevationProfileRef.current));
    await saveAndLeaveToPlans();
  }

  const stageDraftForAction = useCallback(
    (values: PlanFormValues) => {
      const normalizedValues = normalizePlanValuesForPersistence(values);
      latestDraftRef.current = normalizedValues;
      const nextSnapshot = serializePlanValues(normalizedValues, elevationProfileRef.current);
      setDraftSnapshot(nextSnapshot);

      if (id) {
        setPlanEditDraft(id, {
          elevationProfile: elevationProfileRef.current,
          lastSavedSnapshot: lastSavedSnapshotRef.current,
          planName: normalizedValues.name || planName,
          values: normalizedValues,
        });
      }
    },
    [id, planName],
  );

  const handleOpenSummary = useCallback(
    async (values: PlanFormValues) => {
      if (!id) return;

      stageDraftForAction(values);
      const saved = await saveLatestDraft(true);

      if (!saved) {
        Alert.alert(t.common.error, t.profile.saveFailed);
        return;
      }

      captureAnalyticsEvent('plan recap opened', {
        aid_station_count: getIntermediateAidStationCount(values.aidStations),
      });
      router.push(`/(app)/plan/${id}/summary` as any);
    },
    [id, router, saveLatestDraft, stageDraftForAction, t.common.error, t.profile.saveFailed],
  );

  const handleSharePlan = useCallback(
    async (values: PlanFormValues) => {
      if (!id) return;

      try {
        stageDraftForAction(values);
        const saved = await saveLatestDraft(true);
        if (!saved) {
          Alert.alert(t.common.error, t.profile.saveFailed);
          return;
        }

        const normalizedValues = normalizePlanValuesForPersistence(values);
        const productMap = await loadProductMapForPlanValues(normalizedValues);
        const plan = buildStoredRacePlanFromValues({
          id,
          values: normalizedValues,
          elevationProfile: elevationProfileRef.current,
        });
        const summary = buildPlanSummary(plan, productMap);
        const fallbackDepartureTime = new Date();
        const departureTime = await AsyncStorage.getItem(getPlanSummaryDepartureTimeStorageKey(id))
          .then((storedValue) => applyStoredDepartureTime(storedValue, fallbackDepartureTime) ?? fallbackDepartureTime)
          .catch(() => fallbackDepartureTime);
        const shareUrl = await createPlanShareLink({
          summary,
          departureTime,
          locale,
        });

        await Share.share({
          message: `${t.planSummary.shareLinkIntro.replace('{name}', summary.name)}\n${shareUrl}`,
          url: shareUrl,
        });
        captureAnalyticsEvent('plan recap link shared', {
          aid_station_count: getIntermediateAidStationCount(normalizedValues.aidStations),
          product_count: summary.totalProductUnits,
        });
      } catch {
        Alert.alert(t.common.error, t.planSummary.shareFailed);
      }
    },
    [
      id,
      locale,
      saveLatestDraft,
      stageDraftForAction,
      t.common.error,
      t.planSummary.shareFailed,
      t.planSummary.shareLinkIntro,
      t.profile.saveFailed,
    ],
  );

  const handleMissingFavoriteProducts = useCallback(() => {
    Alert.alert(
      'Favoris nutrition requis',
      "Choisis au moins un produit favori dans l'onglet Nutrition pour utiliser le remplissage automatique.",
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: 'Ajouter des favoris',
          onPress: () => router.push('/(app)/nutrition'),
        },
      ],
    );
  }, [router, t.common.cancel]);

  if (loading || premiumLoading || (!error && (loadedPlanId !== id || (initialValues && !planProductData)))) {
    const currentLoadingPlanName = loadingPlanNameId === id ? loadingPlanName : null;
    const visiblePlanName =
      currentLoadingPlanName ?? (loadedPlanId === id ? planName || initialValues?.name || null : null);
    return (
      <>
        <Stack.Screen
          options={{
            headerTitleAlign: 'left',
            headerTitle: () => (
              <AppHeaderTitle
                title={visiblePlanName ? `Modifier : ${visiblePlanName}` : locale === 'fr' ? 'Modifier le plan' : 'Edit plan'}
              />
            ),
          }}
        />
        <PlanLoadingScreen
          planName={visiblePlanName}
          progress={loadingProgress}
          variant="edit"
        />
      </>
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
    <View
      ref={rootRef}
      collapsable={false}
      onLayout={(event) =>
        setTutorialViewport({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })
      }
      style={styles.screen}
    >
      <Stack.Screen
        options={{
          headerTitleAlign: 'left',
          headerTitle: () => (
            <View style={styles.headerTitleWrap}>
              <AppHeaderTitle title={`Modifier : ${planName}`} />
              {saveStatus !== 'idle' ? (
                <View accessibilityLiveRegion="polite" style={styles.saveStatus}>
                  <Ionicons
                    color={saveStatus === 'error' ? Colors.danger : Colors.textSecondary}
                    name={
                      saveStatus === 'saving'
                        ? 'sync-outline'
                        : saveStatus === 'saved'
                          ? 'checkmark-circle-outline'
                          : 'alert-circle-outline'
                    }
                    size={12}
                  />
                  <Text
                    style={[
                      styles.saveStatusText,
                      saveStatus === 'error' ? styles.saveStatusError : null,
                    ]}
                  >
                    {saveStatus === 'saving'
                      ? t.common.saving
                      : saveStatus === 'saved'
                        ? locale === 'fr' ? 'Enregistré' : 'Saved'
                        : locale === 'fr' ? 'Erreur' : 'Error'}
                  </Text>
                </View>
              ) : null}
            </View>
          ),
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
          headerRight: () => (
            <FeedbackHeaderButton
              contextLabel={t.plans.title}
              leading={<HelpHeaderButton screenKey="planEdit" />}
            />
          ),
        }}
      />
      <PlanForm
        key={id}
        initialValues={initialValues}
        elevationProfile={elevationProfile}
        onSave={handleSave}
        onOpenSummary={handleOpenSummary}
        onShare={handleSharePlan}
        isPremium={isPremium}
        onValuesChange={(values) => {
          latestDraftRef.current = values;
          const nextSnapshot = serializePlanValues(values, elevationProfileRef.current);
          setDraftSnapshot(nextSnapshot);
          if (nextSnapshot !== lastSavedSnapshotRef.current) {
            setSaveStatus('idle');
          }
          if (id) {
            if (nextSnapshot === lastSavedSnapshotRef.current) {
              clearPlanEditDraft(id);
              return;
            }
            setPlanEditDraft(id, {
              elevationProfile: elevationProfileRef.current,
              lastSavedSnapshot: lastSavedSnapshotRef.current,
              planName: values.name || planName,
              values,
            });
          }
        }}
        loading={saving}
        saveLabel={t.planSummary.saveAndLeave}
        productData={planProductData}
        compactBasicsByDefault
        onMissingFavoriteProducts={handleMissingFavoriteProducts}
        tutorial={{
          scrollRef,
          onContentSizeChange: setTutorialContentHeight,
          onScroll: handleTutorialScrollEvent,
          onScrollSettled: handleTutorialScrollSettled,
          onTargetMeasure: registerTutorialTarget,
          onTargetRegisterRef: registerTutorialTargetRef,
        }}
      />
      <SpotlightTutorial
        activeStepIndex={tutorialStepIndex}
        closeLabel={t.helpTutorial.close}
        doneLabel={t.helpTutorial.done}
        loadingLabel={t.helpTutorial.loadingTarget}
        nextLabel={t.helpTutorial.next}
        onClose={handleTutorialClose}
        onNext={handleTutorialNext}
        onPrevious={handleTutorialPrevious}
        previousLabel={t.helpTutorial.previous}
        steps={tutorialSteps}
        targetRect={tutorialTargetRect}
        viewportHeight={tutorialViewport.height}
        viewportWidth={tutorialViewport.width}
        visible={tutorialVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  headerTitleWrap: {
    minWidth: 0,
  },
  saveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  saveStatusText: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 13,
  },
  saveStatusError: {
    color: Colors.danger,
  },
});
