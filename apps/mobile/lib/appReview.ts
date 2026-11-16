import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

import {
  shouldRequestAppReview,
  type AppReviewEligibilityContext,
} from './appReviewPolicy';

const APP_REVIEW_STORAGE_KEY = '@trailplanner/app-review/v1';
let promptInFlight: Promise<boolean> | null = null;

type AppReviewState = {
  firstOpenAt: string;
  onboardingCompleted: boolean;
  lastPromptAt: string | null;
  lastSessionStartedAt: string | null;
  pendingPrompt: boolean;
  planCreatedCount: number;
  planSavedCount: number;
  promptCount: number;
  raceCreatedCount: number;
  sessionCount: number;
  totalActiveMs: number;
};

function createDefaultState(): AppReviewState {
  return {
    firstOpenAt: new Date().toISOString(),
    onboardingCompleted: false,
    lastPromptAt: null,
    lastSessionStartedAt: null,
    pendingPrompt: false,
    planCreatedCount: 0,
    planSavedCount: 0,
    promptCount: 0,
    raceCreatedCount: 0,
    sessionCount: 0,
    totalActiveMs: 0,
  };
}

async function readState(): Promise<AppReviewState> {
  try {
    const raw = await AsyncStorage.getItem(APP_REVIEW_STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw) as Partial<AppReviewState>;
    return {
      ...createDefaultState(),
      ...parsed,
    };
  } catch {
    return createDefaultState();
  }
}

async function writeState(state: AppReviewState) {
  try {
    await AsyncStorage.setItem(APP_REVIEW_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

async function updateState(mutator: (state: AppReviewState) => AppReviewState | void) {
  const current = await readState();
  const next = mutator(current) ?? current;
  await writeState(next);
  return next;
}

async function loadStoreReviewModule() {
  try {
    return await import('expo-store-review');
  } catch (error) {
    console.warn('Store review module unavailable for this build:', error);
    return null;
  }
}

export async function noteReviewSessionStart() {
  await updateState((state) => ({
    ...state,
    lastSessionStartedAt: new Date().toISOString(),
    sessionCount: state.sessionCount + 1,
  }));
}

export async function noteReviewActiveDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;

  await updateState((state) => ({
    ...state,
    totalActiveMs: state.totalActiveMs + durationMs,
  }));
}

export async function noteReviewOnboardingCompleted() {
  await updateState((state) => ({
    ...state,
    onboardingCompleted: true,
  }));
}

export async function noteReviewPlanCreated() {
  await updateState((state) => ({
    ...state,
    pendingPrompt: true,
    planCreatedCount: state.planCreatedCount + 1,
  }));
}

export async function noteReviewPlanSaved() {
  await updateState((state) => ({
    ...state,
    pendingPrompt: true,
    planSavedCount: state.planSavedCount + 1,
  }));
}

export async function noteReviewRaceCreated() {
  await updateState((state) => ({
    ...state,
    pendingPrompt: true,
    raceCreatedCount: state.raceCreatedCount + 1,
  }));
}

async function requestAppReview(context: AppReviewEligibilityContext) {
  const state = await readState();
  if (!shouldRequestAppReview(state, context)) return false;

  const StoreReview = await loadStoreReviewModule();
  if (!StoreReview || !(await StoreReview.hasAction())) return false;

  await StoreReview.requestReview();
  await updateState((current) => ({
    ...current,
    lastPromptAt: new Date().toISOString(),
    pendingPrompt: false,
    promptCount: current.promptCount + 1,
  }));
  return true;
}

export async function maybePromptForAppReview(context: AppReviewEligibilityContext = {}) {
  if (__DEV__ || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return false;
  if (promptInFlight) return promptInFlight;

  promptInFlight = requestAppReview(context).catch(() => false);
  try {
    return await promptInFlight;
  } finally {
    promptInFlight = null;
  }
}

const IOS_WRITE_REVIEW_URL = 'https://apps.apple.com/app/id6772180071?action=write-review';
const ANDROID_REVIEW_URL = 'market://details?id=com.paceyourself.app';
const ANDROID_REVIEW_WEB_URL = 'https://play.google.com/store/apps/details?id=com.paceyourself.app';

/**
 * Opens the store review page after the runner explicitly tapped "leave a review" (for example after
 * saying the app was useful in a feedback survey). The native in-app prompt is throttled by the OS
 * and may silently show nothing, so an explicit tap goes to the store page instead.
 */
export async function openStoreReviewPage() {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL(IOS_WRITE_REVIEW_URL);
      return true;
    }
    if (Platform.OS === 'android') {
      const canOpenMarket = await Linking.canOpenURL(ANDROID_REVIEW_URL).catch(() => false);
      await Linking.openURL(canOpenMarket ? ANDROID_REVIEW_URL : ANDROID_REVIEW_WEB_URL);
      return true;
    }
  } catch (error) {
    console.warn('Unable to open the store review page:', error);
  }
  return false;
}
