import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';

const APP_REVIEW_STORAGE_KEY = '@trailplanner/app-review/v1';
const MIN_SESSION_COUNT = 5;
const MIN_ACTIVE_MINUTES = 20;
const MIN_PLAN_SAVE_COUNT = 1;
const PROMPT_COOLDOWN_DAYS = 60;
const MAX_PROMPT_COUNT = 3;

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

function hasMeaningfulEngagement(state: AppReviewState) {
  return (
    state.planCreatedCount >= 1 &&
    (state.planSavedCount >= MIN_PLAN_SAVE_COUNT || state.raceCreatedCount >= 1)
  );
}

function hasCompletedOnboardingEnough(state: AppReviewState) {
  return state.onboardingCompleted || state.planCreatedCount > 0 || state.planSavedCount > 0 || state.raceCreatedCount > 0;
}

function isPromptCooldownElapsed(lastPromptAt: string | null) {
  if (!lastPromptAt) return true;
  const lastPromptTime = new Date(lastPromptAt).getTime();
  if (!Number.isFinite(lastPromptTime)) return true;
  return Date.now() - lastPromptTime >= PROMPT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
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

export async function maybePromptForAppReview() {
  if (__DEV__ || Platform.OS !== 'android') return false;

  const state = await readState();
  if (!state.pendingPrompt) return false;
  if (state.promptCount >= MAX_PROMPT_COUNT) return false;
  if (!hasCompletedOnboardingEnough(state)) return false;
  if (state.sessionCount < MIN_SESSION_COUNT) return false;
  if (state.totalActiveMs < MIN_ACTIVE_MINUTES * 60 * 1000) return false;
  if (!hasMeaningfulEngagement(state)) return false;
  if (!isPromptCooldownElapsed(state.lastPromptAt)) return false;

  const hasAction = await StoreReview.hasAction();
  if (!hasAction) return false;

  try {
    await StoreReview.requestReview();
    await updateState((current) => ({
      ...current,
      lastPromptAt: new Date().toISOString(),
      pendingPrompt: false,
      promptCount: current.promptCount + 1,
    }));
    return true;
  } catch {
    return false;
  }
}
