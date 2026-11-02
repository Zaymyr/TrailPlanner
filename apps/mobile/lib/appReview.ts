import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
