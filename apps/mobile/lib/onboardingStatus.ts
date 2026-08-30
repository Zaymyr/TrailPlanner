import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureAppSession } from './appSession';
import { captureAnalyticsEvent } from './posthog';
import { supabase } from './supabase';
import {
  DEFAULT_ONBOARDING_STATUSES,
  parseOnboardingStatuses,
  type OnboardingKind,
  type OnboardingStatuses,
} from './onboardingStatusCore';

export {
  DEFAULT_ONBOARDING_STATUSES,
  hasPendingOnboarding,
  parseOnboardingStatuses,
  type OnboardingKind,
  type OnboardingStatus,
  type OnboardingStatuses,
} from './onboardingStatusCore';

export type OnboardingProgress = {
  kind: OnboardingKind;
  stage: 'setup' | 'catalog' | 'nutrition' | 'plan' | 'racebook';
  selectedRaceId?: string | null;
};

const PROGRESS_KEY = 'pace-yourself.mobile-onboarding-progress';
const listeners = new Set<(statuses: OnboardingStatuses) => void>();

function emit(statuses: OnboardingStatuses) {
  for (const listener of listeners) listener(statuses);
}

export function addOnboardingStatusListener(listener: (statuses: OnboardingStatuses) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadOnboardingStatuses(userId?: string | null): Promise<OnboardingStatuses> {
  const resolvedUserId = userId ?? (await ensureAppSession())?.user.id ?? null;
  if (!resolvedUserId) return DEFAULT_ONBOARDING_STATUSES;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('plan_onboarding_status, racebook_onboarding_status')
    .eq('user_id', resolvedUserId)
    .maybeSingle();

  if (error) throw error;
  return parseOnboardingStatuses(data);
}

async function updateStatuses(patch: Partial<OnboardingStatuses>) {
  const session = await ensureAppSession();
  const userId = session?.user.id;
  if (!userId) throw new Error('Unable to resolve onboarding user');

  const payload: Record<string, string> = {};
  if (patch.plan) payload.plan_onboarding_status = patch.plan;
  if (patch.racebook) payload.racebook_onboarding_status = patch.racebook;

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' })
    .select('plan_onboarding_status, racebook_onboarding_status')
    .single();

  if (error) throw error;
  const statuses = parseOnboardingStatuses(data);
  emit(statuses);
  return statuses;
}

export async function startOnboarding(kind: OnboardingKind, replay = false) {
  if (!replay) await updateStatuses({ [kind]: 'in_progress' });
  await saveOnboardingProgress({ kind, stage: kind === 'plan' ? 'setup' : 'catalog' });
  captureAnalyticsEvent('onboarding started', { onboarding_kind: kind, replay });
}

export async function skipOnboardingKind(kind: OnboardingKind, stage?: string) {
  const currentStatuses = await loadOnboardingStatuses();
  const statuses = currentStatuses[kind] === 'completed'
    ? currentStatuses
    : await updateStatuses({ [kind]: 'skipped' });
  await clearOnboardingProgress();
  captureAnalyticsEvent('onboarding skipped', { onboarding_kind: kind, stage: stage ?? null });
  return statuses;
}

export async function skipOnboardingChoice() {
  const statuses = await updateStatuses({ plan: 'skipped', racebook: 'skipped' });
  await clearOnboardingProgress();
  captureAnalyticsEvent('onboarding choice skipped');
  return statuses;
}

export async function completeOnboarding(kind: OnboardingKind) {
  const statuses = await updateStatuses({ [kind]: 'completed' });
  await clearOnboardingProgress();
  captureAnalyticsEvent('onboarding completed', { onboarding_kind: kind });
  return statuses;
}

export async function saveOnboardingProgress(progress: OnboardingProgress) {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export async function loadOnboardingProgress(): Promise<OnboardingProgress | null> {
  const raw = await AsyncStorage.getItem(PROGRESS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingProgress;
  } catch {
    await AsyncStorage.removeItem(PROGRESS_KEY);
    return null;
  }
}

export async function clearOnboardingProgress() {
  await AsyncStorage.removeItem(PROGRESS_KEY);
}
