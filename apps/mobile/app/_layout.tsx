import { Text, View, ScrollView, AppState } from 'react-native';

// Global error handlers - must be first
const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError(...args);
};

if (typeof ErrorUtils !== 'undefined') {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('GLOBAL ERROR:', error?.message, error?.stack);
  });
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { AppLaunchScreen } from '../components/AppLaunchScreen';
import { PlanLoadingScreen } from '../components/PlanLoadingScreen';
import { usePremium } from '../hooks/usePremium';
import {
  finalizePendingAccountConversion,
  finalizePendingGuestMerge,
  hasPendingGuestMerge,
} from '../lib/accountConversion';
import { ensureAppSession, isAnonymousSession } from '../lib/appSession';
import { noteReviewActiveDuration, noteReviewSessionStart } from '../lib/appReview';
import { syncPushDeviceRegistration } from '../lib/pushRegistration';
import { primePlansScreenBootstrap } from '../lib/plansScreenBootstrap';
import { refreshInactivityReminder } from '../lib/reminderNotifications';
import { supabase, supabaseInitError } from '../lib/supabase';
import { respondToAlert } from '../lib/raceLiveSession';
import { I18nProvider, useI18n } from '../lib/i18n';
import { getPostAuthRoute, shouldOpenOnboarding } from '../lib/onboardingGate';
import {
  addPendingOnboardingTransitionListener,
  getPendingOnboardingTransition,
} from '../lib/onboardingTransition';
import { ensureTrialStatusForSession } from '../lib/trial';

const SNOOZE_OPTIONS_MINUTES = [5, 10, 15] as const;

// Show notifications even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string | null}> {
  state = { error: null };
  componentDidCatch(error: Error) {
    this.setState({ error: error.message + '\n' + error.stack });
  }
  render() {
    if (this.state.error) {
      const { ScrollView, Text } = require('react-native');
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#0f172a', padding: 20, paddingTop: 60 }}>
          <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>🔴 Crash</Text>
          <Text style={{ color: '#f1f5f9', fontSize: 11 }}>{this.state.error}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };

export default function RootLayout() {
  return (
    <I18nProvider>
      <RootLayoutContent />
    </I18nProvider>
  );
}

type StartupUpdateState =
  | { status: 'checking'; detail: string | null }
  | { status: 'downloading'; detail: string | null }
  | { status: 'restarting'; detail: string | null }
  | { status: 'rollback'; detail: string | null }
  | { status: 'rollingBack'; detail: string | null }
  | { status: 'error'; detail: string | null }
  | { status: 'done'; detail: string | null };

type LaunchScreenModel = {
  title: string;
  subtitle: string;
  progress: number;
  showSpinner: boolean;
  detail: string | null;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function RootLayoutContent() {
  const { locale, t } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [bootstrappingSession, setBootstrappingSession] = useState(false);
  const [mergingGuestData, setMergingGuestData] = useState(false);
  const [pendingOnboardingTransition, setPendingOnboardingTransitionState] = useState(
    () => getPendingOnboardingTransition(),
  );
  const [updateState, setUpdateState] = useState<StartupUpdateState>({ status: 'checking', detail: null });
  const { isLoading: premiumLoading } = usePremium();
  const segments = useSegments();
  const router = useRouter();
  const startupUpdateRunRef = useRef(false);
  const foregroundUpdateCheckInFlightRef = useRef(false);
  const hasShownForegroundUpdateNotificationRef = useRef(false);
  const pushRegistrationInFlightRef = useRef(false);
  const pushPermissionAutoRequestUserIdRef = useRef<string | null>(null);
  const launchWasBlockingRef = useRef(true);
  const initialRedirectInFlightRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const activeUsageStartedAtRef = useRef<number | null>(null);
  const shouldHoldForPremium = Boolean(session) && premiumLoading;
  const authenticatedPushUserId =
    session && !isAnonymousSession(session) ? session.user.id : null;
  const [displayedOnboardingTransition, setDisplayedOnboardingTransition] = useState(
    () => getPendingOnboardingTransition(),
  );
  const [onboardingTransitionExiting, setOnboardingTransitionExiting] = useState(false);
  const [launchScreenExiting, setLaunchScreenExiting] = useState(false);
  const shouldHoldForInitialRoute = !segments[0];

  if (supabaseInitError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', padding: 20, paddingTop: 60 }}>
        <Text style={{ color: '#ef4444' }}>Supabase Error: {supabaseInitError}</Text>
      </View>
    );
  }

  const runStartupUpdateCheck = useCallback(async () => {
    if (startupUpdateRunRef.current) return;
    startupUpdateRunRef.current = true;

    if (__DEV__ || !Updates.isEnabled) {
      setUpdateState({ status: 'done', detail: null });
      return;
    }

    setUpdateState({ status: 'checking', detail: null });

    try {
      const emergencyLaunchDetail = Updates.isEmergencyLaunch
        ? Updates.emergencyLaunchReason ?? null
        : null;

      if (Updates.isEmergencyLaunch) {
        console.warn('expo-updates emergency launch detected:', emergencyLaunchDetail);
      }

      const updateCheck = await Updates.checkForUpdateAsync();

      if (updateCheck.isRollBackToEmbedded) {
        setUpdateState({
          status: Updates.isEmbeddedLaunch ? 'rollback' : 'rollingBack',
          detail: emergencyLaunchDetail,
        });

        if (!Updates.isEmbeddedLaunch) {
          await wait(900);
          await Updates.reloadAsync();
        }
        return;
      }

      if (!updateCheck.isAvailable) {
        if (Updates.isEmergencyLaunch) {
          setUpdateState({ status: 'rollback', detail: emergencyLaunchDetail });
          return;
        }
        setUpdateState({ status: 'done', detail: null });
        return;
      }

      setUpdateState({ status: 'downloading', detail: null });
      const fetchResult = await Updates.fetchUpdateAsync();

      if (fetchResult.isRollBackToEmbedded) {
        setUpdateState({
          status: 'rollingBack',
          detail: emergencyLaunchDetail,
        });
        await wait(900);
        await Updates.reloadAsync();
        return;
      }

      if (fetchResult.isNew) {
        setUpdateState({ status: 'restarting', detail: null });
        await wait(900);
        await Updates.reloadAsync();
        return;
      }

      setUpdateState({ status: 'done', detail: null });
    } catch (error) {
      console.error('Startup OTA update check failed:', error);
      startupUpdateRunRef.current = false;
      setUpdateState({
        status: 'error',
        detail: error instanceof Error ? error.message : null,
      });
    }
  }, []);

  useEffect(() => {
    void runStartupUpdateCheck();
  }, [runStartupUpdateCheck]);

  const syncBackendPushRegistration = useCallback(async (requestIfNeeded = false) => {
    if (pushRegistrationInFlightRef.current) return;
    if (!session?.access_token) return;

    pushRegistrationInFlightRef.current = true;

    try {
      await syncPushDeviceRegistration({
        accessToken: session.access_token,
        locale,
        requestIfNeeded,
      });
    } finally {
      pushRegistrationInFlightRef.current = false;
    }
  }, [locale, session?.access_token]);

  useEffect(() => {
    if (updateState.status !== 'done') return undefined;

    const checkForForegroundUpdate = async () => {
      if (__DEV__ || !Updates.isEnabled) return;
      if (foregroundUpdateCheckInFlightRef.current) return;
      if (hasShownForegroundUpdateNotificationRef.current) return;

      foregroundUpdateCheckInFlightRef.current = true;

      try {
        const updateCheck = await Updates.checkForUpdateAsync();
        if (!updateCheck.isAvailable) {
          return;
        }

        const fetchResult = await Updates.fetchUpdateAsync();
        if (!fetchResult.isNew) {
          return;
        }

        hasShownForegroundUpdateNotificationRef.current = true;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: t.appUpdate.readyNotificationTitle,
            body: t.appUpdate.readyNotificationBody,
            sound: true,
            data: {
              updateAction: 'reload',
            },
          },
          trigger: null,
        });
      } catch (error) {
        console.error('Foreground OTA update check failed:', error);
      } finally {
        foregroundUpdateCheckInFlightRef.current = false;
      }
    };

    const syncInactivityReminder = async () => {
      await refreshInactivityReminder({
        title: t.reminders.inactivityTitle,
        body: t.reminders.inactivityBody,
        href: '/(app)/plans',
      });
    };

    const flushActiveUsage = async () => {
      const startedAt = activeUsageStartedAtRef.current;
      activeUsageStartedAtRef.current = null;
      if (startedAt == null) return;
      await noteReviewActiveDuration(Date.now() - startedAt);
    };

    const syncBackendPushRegistrationForCurrentSession = () => {
      if (!session?.access_token) return;

      const shouldAutoRequestPermission =
        authenticatedPushUserId != null &&
        pushPermissionAutoRequestUserIdRef.current !== authenticatedPushUserId;

      if (shouldAutoRequestPermission) {
        pushPermissionAutoRequestUserIdRef.current = authenticatedPushUserId;
      }

      void syncBackendPushRegistration(shouldAutoRequestPermission);
    };

    if (AppState.currentState === 'active') {
      activeUsageStartedAtRef.current = Date.now();
      void noteReviewSessionStart();
      void syncInactivityReminder();
      syncBackendPushRegistrationForCurrentSession();
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (previousState === 'active' && nextState !== 'active') {
        void flushActiveUsage();
      }

      if (previousState !== 'active' && nextState === 'active') {
        activeUsageStartedAtRef.current = Date.now();
        void noteReviewSessionStart();
        void syncInactivityReminder();
        void checkForForegroundUpdate();
        syncBackendPushRegistrationForCurrentSession();
      }
    });

    return () => {
      void flushActiveUsage();
      subscription.remove();
    };
  }, [
    t.appUpdate.readyNotificationBody,
    t.appUpdate.readyNotificationTitle,
    t.reminders.inactivityBody,
    t.reminders.inactivityTitle,
    syncBackendPushRegistration,
    updateState.status,
  ]);

  useEffect(() => {
    if (updateState.status !== 'done') return;
    if (AppState.currentState !== 'active') return;
    if (!session?.access_token) return;

    const shouldAutoRequestPermission =
      authenticatedPushUserId != null &&
      pushPermissionAutoRequestUserIdRef.current !== authenticatedPushUserId;

    if (shouldAutoRequestPermission) {
      pushPermissionAutoRequestUserIdRef.current = authenticatedPushUserId;
    }

    void syncBackendPushRegistration(shouldAutoRequestPermission);
  }, [
    authenticatedPushUserId,
    session?.access_token,
    syncBackendPushRegistration,
    updateState.status,
  ]);

  useEffect(() => {
    return addPendingOnboardingTransitionListener((transition) => {
      setPendingOnboardingTransitionState(transition);
    });
  }, []);

  useEffect(() => {
    if (pendingOnboardingTransition) {
      setDisplayedOnboardingTransition(pendingOnboardingTransition);
      setOnboardingTransitionExiting(false);
      return;
    }

    const hasTransitionToDismiss = Boolean(displayedOnboardingTransition);
    if (!hasTransitionToDismiss) {
      setOnboardingTransitionExiting(false);
      return;
    }

    setDisplayedOnboardingTransition((current) =>
      current
        ? {
            ...current,
            progress: 1,
          }
        : current,
    );
    setOnboardingTransitionExiting(true);

    const timeout = setTimeout(() => {
      setDisplayedOnboardingTransition(null);
      setOnboardingTransitionExiting(false);
    }, 280);

    return () => clearTimeout(timeout);
  }, [pendingOnboardingTransition]);

  // Auth listener
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      supabase.auth.getSession().then(({ data: { session: s } }: { data: { session: Session | null } }) => {
        setSession(s);
        setReady(true);
      }).catch((err: Error) => {
        console.error('Failed to get session:', err);
        setReady(true);
      });

      const { data } = supabase.auth.onAuthStateChange(
        (_event: any, s: Session | null) => setSession(s),
      );
      subscription = data.subscription;
    } catch (err) {
      console.error('Auth listener setup failed:', err);
      setReady(true);
    }

    return () => {
      try {
        subscription?.unsubscribe();
      } catch (err) {
        console.error('Failed to unsubscribe auth listener:', err);
      }
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    void ensureTrialStatusForSession(session);
  }, [session]);

  useEffect(() => {
    if (!session || isAnonymousSession(session)) return;

    void finalizePendingAccountConversion(session).then((result) => {
      if (!result.completed && result.reason === 'password-update-failed') {
        console.warn('Pending account conversion could not finalize password automatically.', result.error);
      }
    });
  }, [session]);

  useEffect(() => {
    if (!session || isAnonymousSession(session)) return;

    let cancelled = false;

    void hasPendingGuestMerge().then((pending) => {
      if (!pending || cancelled) return;

      setMergingGuestData(true);

      void finalizePendingGuestMerge(session)
        .then((result) => {
          if (!result.merged && result.reason === 'merge-request-failed') {
            console.warn('Pending guest merge could not complete automatically.', result.error);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setMergingGuestData(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [session]);

  // Route guard
  useEffect(() => {
    if (!ready || updateState.status !== 'done' || shouldHoldForPremium || mergingGuestData) return;

    const currentPath = segments.join('/');
    const atRootIndex = !segments[0];
    const inAuthGroup = segments[0] === '(auth)';
    const hasPendingOnboardingTransition = Boolean(getPendingOnboardingTransition());
    const inOnboarding =
      currentPath === '(app)/onboarding' ||
      currentPath === '(app)/onboarding-finalizing' ||
      currentPath.startsWith('(app)/onboarding/');

    if (!session && !inAuthGroup) {
      if (bootstrappingSession) return;

      setBootstrappingSession(true);
      void ensureAppSession()
        .catch((error) => {
          console.error('Unable to create anonymous session:', error);
          router.replace('/(auth)/login');
          return null;
        })
        .finally(() => {
          setBootstrappingSession(false);
        });
      return;
    }

    if (session && atRootIndex && !hasPendingOnboardingTransition) {
      if (initialRedirectInFlightRef.current) return;
      initialRedirectInFlightRef.current = true;

      void (async () => {
        try {
          const nextRoute = await getPostAuthRoute(session);
          if (nextRoute === '/(app)/plans') {
            try {
              await primePlansScreenBootstrap(session);
            } catch (error) {
              console.error('Failed to preload plans screen during startup:', error);
            }
          }
          router.replace(nextRoute);
        } finally {
          initialRedirectInFlightRef.current = false;
        }
      })();
      return;
    }

    if (session && !inAuthGroup && !hasPendingOnboardingTransition) {
      void shouldOpenOnboarding(session).then((needsOnboarding) => {
        if (needsOnboarding && !inOnboarding) {
          router.replace('/(app)/onboarding');
        }
      });
    }

    if (session && inAuthGroup && !isAnonymousSession(session)) {
      (async () => {
        const nextRoute = await getPostAuthRoute(session);
        if (nextRoute === '/(app)/plans') {
          try {
            await primePlansScreenBootstrap(session);
          } catch (error) {
            console.error('Failed to preload plans screen after auth:', error);
          }
        }
        router.replace(nextRoute);
      })();
    }
  }, [bootstrappingSession, mergingGuestData, session, ready, segments, shouldHoldForPremium, updateState.status, router]);

  // Notification response listener
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const alertId =
          response.notification.request.content.data?.alertId as
            | string
            | undefined;
        const href = response.notification.request.content.data?.href as string | undefined;
        const updateAction = response.notification.request.content.data?.updateAction as string | undefined;
        if (alertId) {
          const action = response.actionIdentifier;

          if (action === 'confirm') {
            await respondToAlert(alertId, 'confirmed');
          } else if (action === 'skip') {
            await respondToAlert(alertId, 'skipped');
          } else if (action.startsWith('snooze_')) {
            const minutes = parseInt(action.replace('snooze_', ''), 10);
            if (SNOOZE_OPTIONS_MINUTES.includes(minutes as 5 | 10 | 15)) {
              await respondToAlert(alertId, 'snoozed', minutes);
            }
          }
        }

        if (updateAction === 'reload') {
          await Updates.reloadAsync();
          return;
        }

        if (href) {
          router.push(href as any);
        }
      },
    );

    return () => sub.remove();
  }, [router]);

  const launchScreen = useMemo<LaunchScreenModel>(() => {
    if (updateState.status === 'error') {
      return {
        title: t.appUpdate.errorTitle,
        subtitle: t.appUpdate.errorSubtitle,
        progress: 0.88,
        showSpinner: false,
        detail: updateState.detail,
      };
    }

    if (updateState.status === 'restarting') {
      return {
        title: t.appUpdate.installingTitle,
        subtitle: t.appUpdate.installingSubtitle,
        progress: 0.96,
        showSpinner: true,
        detail: null,
      };
    }

    if (updateState.status === 'rollingBack') {
      return {
        title: t.appUpdate.rollbackInstallingTitle,
        subtitle: t.appUpdate.rollbackInstallingSubtitle,
        progress: 0.94,
        showSpinner: true,
        detail: updateState.detail,
      };
    }

    if (updateState.status === 'rollback') {
      return {
        title: t.appUpdate.rollbackTitle,
        subtitle: t.appUpdate.rollbackSubtitle,
        progress: 0.86,
        showSpinner: false,
        detail: updateState.detail,
      };
    }

    if (updateState.status === 'downloading') {
      return {
        title: t.appUpdate.downloadingTitle,
        subtitle: t.appUpdate.downloadingSubtitle,
        progress: 0.28,
        showSpinner: true,
        detail: null,
      };
    }

    if (updateState.status === 'checking') {
      return {
        title: t.appUpdate.checkingTitle,
        subtitle: t.appUpdate.checkingSubtitle,
        progress: 0.12,
        showSpinner: true,
        detail: null,
      };
    }

    if (mergingGuestData) {
      return {
        title: t.appUpdate.startupTitle,
        subtitle: t.appUpdate.startupSubtitle,
        progress: 0.8,
        showSpinner: true,
        detail: null,
      };
    }

    if (shouldHoldForPremium) {
      return {
        title: t.appUpdate.startupTitle,
        subtitle: t.appUpdate.startupSubtitle,
        progress: 0.88,
        showSpinner: true,
        detail: null,
      };
    }

    if (bootstrappingSession) {
      return {
        title: t.appUpdate.startupTitle,
        subtitle: t.appUpdate.startupSubtitle,
        progress: 0.56,
        showSpinner: true,
        detail: null,
      };
    }

    if (!ready) {
      return {
        title: t.appUpdate.startupTitle,
        subtitle: t.appUpdate.startupSubtitle,
        progress: 0.36,
        showSpinner: true,
        detail: null,
      };
    }

    if (shouldHoldForInitialRoute) {
      return {
        title: t.appUpdate.startupTitle,
        subtitle: t.appUpdate.startupSubtitle,
        progress: 0.72,
        showSpinner: true,
        detail: null,
      };
    }

    return {
      title: t.appUpdate.startupTitle,
      subtitle: t.appUpdate.startupSubtitle,
      progress: 0.96,
      showSpinner: true,
      detail: null,
    };
  }, [bootstrappingSession, mergingGuestData, ready, shouldHoldForInitialRoute, shouldHoldForPremium, t, updateState]);

  const isLaunchBlocking =
    !ready ||
    updateState.status !== 'done' ||
    shouldHoldForPremium ||
    shouldHoldForInitialRoute ||
    bootstrappingSession ||
    mergingGuestData;
  const [launchExitScreen, setLaunchExitScreen] = useState<LaunchScreenModel>(launchScreen);

  useEffect(() => {
    if (isLaunchBlocking) {
      launchWasBlockingRef.current = true;
      setLaunchExitScreen(launchScreen);
      setLaunchScreenExiting(false);
      return;
    }

    launchWasBlockingRef.current = false;
    setLaunchExitScreen({
      title: t.appUpdate.startupTitle,
      subtitle: t.appUpdate.startupSubtitle,
      progress: 1,
      showSpinner: false,
      detail: null,
    });
    setLaunchScreenExiting(true);

    const timeout = setTimeout(() => {
      setLaunchScreenExiting(false);
    }, 320);

    return () => clearTimeout(timeout);
  }, [
    isLaunchBlocking,
    launchScreen,
    t.appUpdate.startupSubtitle,
    t.appUpdate.startupTitle,
  ]);
  const shouldRenderLaunchExit = !isLaunchBlocking && (launchScreenExiting || launchWasBlockingRef.current);

  if (isLaunchBlocking) {
    return (
      <AppLaunchScreen
        title={launchScreen.title}
        subtitle={launchScreen.subtitle}
        progress={launchScreen.progress}
        showSpinner={launchScreen.showSpinner}
        isFinishing={false}
        detail={
          shouldHoldForPremium || bootstrappingSession || mergingGuestData
            ? t.common.loading
            : launchScreen.detail
        }
        primaryAction={
          !shouldHoldForPremium && !bootstrappingSession && !mergingGuestData && updateState.status === 'error'
            ? {
                label: t.common.retry,
                onPress: () => {
                  startupUpdateRunRef.current = false;
                  void runStartupUpdateCheck();
                },
              }
            : !shouldHoldForPremium && updateState.status === 'rollback'
              ? {
                  label: t.appUpdate.continueCta,
                  onPress: () => setUpdateState({ status: 'done', detail: null }),
                }
            : undefined
        }
        secondaryAction={
          !shouldHoldForPremium && !bootstrappingSession && !mergingGuestData && updateState.status === 'error'
            ? {
                label: t.appUpdate.continueCta,
                onPress: () => setUpdateState({ status: 'done', detail: null }),
                variant: 'secondary',
              }
            : undefined
        }
      />
    );
  }

  const appContent = (
    <>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#f1f5f9',
            contentStyle: { backgroundColor: '#0f172a' },
          }}
        >
          <Stack.Screen name="(app)" options={{ title: 'Pace Yourself', headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack>
        {displayedOnboardingTransition ? (
          <View
            pointerEvents={onboardingTransitionExiting ? 'none' : 'auto'}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          >
            <PlanLoadingScreen
              planName={displayedOnboardingTransition.planName}
              progress={displayedOnboardingTransition.progress}
              stage={t.plans.planLoadingStage}
              title={
                displayedOnboardingTransition.planName
                  ? t.plans.planLoadingNamed.replace(
                      '{name}',
                      displayedOnboardingTransition.planName,
                    )
                  : t.plans.planLoadingGeneric
              }
              isFinishing={onboardingTransitionExiting}
            />
          </View>
        ) : null}
        {shouldRenderLaunchExit ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          >
            <AppLaunchScreen
              title={launchExitScreen.title}
              subtitle={launchExitScreen.subtitle}
              progress={launchScreenExiting ? launchExitScreen.progress : 1}
              showSpinner={launchScreenExiting ? launchExitScreen.showSpinner : false}
              detail={launchScreenExiting ? launchExitScreen.detail : null}
              isFinishing
            />
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <ErrorBoundary>
      {appContent}
    </ErrorBoundary>
  );
}
