import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import type { PlanRow, RaceSection } from '../components/plans/types';
import { usePremium } from '../hooks/usePremium';
import { maybePromptForAppReview } from '../lib/appReview';
import { useI18n } from '../lib/i18n';
import { FREE_PLAN_LIMIT, getAccessiblePlanIds } from '../lib/planAccess';
import { fetchPlansScreenBootstrap, readPlansScreenBootstrap } from '../lib/plansScreenBootstrap';
import { syncPushDeviceRegistration } from '../lib/pushRegistration';
import { getSession } from '../lib/raceLiveSession';
import { clearUnfinishedPlanReminder, syncLatestUnfinishedPlanReminder } from '../lib/reminderNotifications';
import { supabase } from '../lib/supabase';

export function usePlansScreen() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const initialBootstrapRef = useRef(readPlansScreenBootstrap());
  const [plans, setPlans] = useState<PlanRow[]>(() => initialBootstrapRef.current?.plans ?? []);
  const [userId, setUserId] = useState<string | null>(() => initialBootstrapRef.current?.userId ?? null);
  const [isAnonymous, setIsAnonymous] = useState(() => initialBootstrapRef.current?.isAnonymous ?? false);
  const [raceOwnership, setRaceOwnership] = useState<Record<string, string | null>>(
    () => initialBootstrapRef.current?.raceOwnership ?? {},
  );
  const [loading, setLoading] = useState(() => initialBootstrapRef.current == null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [premiumModalCopy, setPremiumModalCopy] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const pushRegistrationPromptedUserIdRef = useRef<string | null>(null);

  const fetchData = useCallback(async (options?: { showLoading?: boolean }) => {
    if (options?.showLoading) {
      setLoading(true);
    }

    setError(null);

    try {
      const bootstrap = await fetchPlansScreenBootstrap();
      setUserId(bootstrap.userId);
      setIsAnonymous(bootstrap.isAnonymous);
      setPlans(bootstrap.plans);
      setRaceOwnership(bootstrap.raceOwnership);

      void syncLatestUnfinishedPlanReminder(bootstrap.plans, {
        title: t.reminders.unfinishedPlanTitle,
        buildBody: (planName) => t.reminders.unfinishedPlanBody.replace('{name}', planName),
        hrefForPlan: (planId) => `/(app)/plan/${planId}/edit`,
      });

      return bootstrap;
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : t.common.error;
      setError(message);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.common.error, t.reminders.unfinishedPlanBody, t.reminders.unfinishedPlanTitle]);

  const syncActivePlan = useCallback(() => {
    setActivePlanId(getSession()?.plan.id ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void (async () => {
        const bootstrap = await fetchData({ showLoading: initialBootstrapRef.current == null });
        if (cancelled || !bootstrap || bootstrap.isAnonymous || !bootstrap.userId) {
          return;
        }

        const shouldRequestPermission = pushRegistrationPromptedUserIdRef.current !== bootstrap.userId;
        if (shouldRequestPermission) {
          pushRegistrationPromptedUserIdRef.current = bootstrap.userId;
        }

        await syncPushDeviceRegistration({
          locale,
          requestIfNeeded: shouldRequestPermission,
        });
      })();

      initialBootstrapRef.current = null;
      syncActivePlan();
      const reviewTimer = setTimeout(() => {
        void maybePromptForAppReview();
      }, 650);

      return () => {
        cancelled = true;
        clearTimeout(reviewTimer);
      };
    }, [fetchData, locale, syncActivePlan]),
  );

  const openPremiumModal = useCallback((title: string, message: string) => {
    setPremiumModalCopy({ title, message });
  }, []);

  const closePremiumModal = useCallback(() => {
    setPremiumModalCopy(null);
  }, []);

  const handleDelete = useCallback(
    (planId: string) => {
      Alert.alert(t.plans.deleteTitle, t.plans.deleteMessage, [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            const { error: deleteError } = await supabase.from('race_plans').delete().eq('id', planId);
            if (deleteError) {
              Alert.alert(t.common.error, deleteError.message);
              return;
            }

            await clearUnfinishedPlanReminder(planId);
            setPlans((current) => {
              const nextPlans = current.filter((plan) => plan.id !== planId);
              void syncLatestUnfinishedPlanReminder(nextPlans, {
                title: t.reminders.unfinishedPlanTitle,
                buildBody: (planName) => t.reminders.unfinishedPlanBody.replace('{name}', planName),
                hrefForPlan: (nextPlanId) => `/(app)/plan/${nextPlanId}/edit`,
              });
              return nextPlans;
            });
          },
        },
      ]);
    },
    [
      t.common.cancel,
      t.common.delete,
      t.common.error,
      t.plans.deleteMessage,
      t.plans.deleteTitle,
      t.reminders.unfinishedPlanBody,
      t.reminders.unfinishedPlanTitle,
    ],
  );

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const sections = useMemo<RaceSection[]>(() => {
    const grouped: Record<string, PlanRow[]> = {};
    for (const plan of plans) {
      const key = plan.race_id ?? '__orphan__';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(plan);
    }

    const result: RaceSection[] = [];

    for (const [key, planList] of Object.entries(grouped)) {
      if (key === '__orphan__') continue;

      const raceName = planList[0]?.races?.name ?? t.plans.noCatalogRace;
      const createdBy = raceOwnership[key] ?? null;
      result.push({
        raceId: key,
        raceName,
        isOwned: createdBy === userId,
        isAdmin: !createdBy,
        data: planList,
      });
    }

    result.sort((left, right) => {
      if (left.isOwned && !right.isOwned) return -1;
      if (!left.isOwned && right.isOwned) return 1;
      return left.raceName.localeCompare(right.raceName);
    });

    const orphanPlans = grouped.__orphan__ ?? [];
    if (orphanPlans.length > 0) {
      result.push({
        raceId: null,
        raceName: t.plans.noRace,
        isOwned: false,
        isAdmin: false,
        data: orphanPlans,
      });
    }

    return result;
  }, [plans, raceOwnership, t.plans.noCatalogRace, t.plans.noRace, userId]);

  const accessiblePlanIds = useMemo(
    () => getAccessiblePlanIds(plans, isPremium, isAnonymous),
    [isAnonymous, isPremium, plans],
  );

  const handleRetry = useCallback(() => {
    setError(null);
    void fetchData({ showLoading: true });
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData({ showLoading: false });
  }, [fetchData]);

  const handleCreateFirstPlan = useCallback(() => {
    router.push('/(app)/plan/new');
  }, [router]);

  const handleOpenGuestAccountUpgrade = useCallback(() => {
    router.push('/(auth)/login');
  }, [router]);

  const handleEditRace = useCallback(
    (raceId: string) => {
      router.push(`/(app)/race/${raceId}/edit` as any);
    },
    [router],
  );

  const handleOpenCatalog = useCallback(() => {
    router.push('/(app)/catalog');
  }, [router]);

  const handleOpenEditPlan = useCallback(
    (planId: string) => {
      router.push(`/(app)/plan/${planId}/edit` as any);
    },
    [router],
  );

  const handleOpenRacePlan = useCallback(
    (planId: string) => {
      router.push(`/(app)/race/${planId}` as any);
    },
    [router],
  );

  const handleOpenLockedPlan = useCallback(() => {
    openPremiumModal(
      t.plans.freeAccessTitle,
      t.plans.freeAccessMessage.replace('{count}', String(FREE_PLAN_LIMIT)),
    );
  }, [openPremiumModal, t.plans.freeAccessMessage, t.plans.freeAccessTitle]);

  return {
    locale,
    t,
    isPremium,
    loading,
    premiumLoading,
    error,
    refreshing,
    sections,
    collapsedSections,
    activePlanId,
    isAnonymous,
    accessiblePlanIds,
    premiumModalCopy,
    handleRetry,
    handleRefresh,
    handleDelete,
    toggleSection,
    handleCreateFirstPlan,
    handleOpenGuestAccountUpgrade,
    handleEditRace,
    handleOpenCatalog,
    handleOpenEditPlan,
    handleOpenRacePlan,
    handleOpenLockedPlan,
    closePremiumModal,
  };
}
