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
  isOnboardingUntouched,
  LIVRET_ONBOARDING_KINDS,
  parseOnboardingStatuses,
  type OnboardingKind,
  type OnboardingStatus,
  type OnboardingStatuses,
} from './onboardingStatusCore';

export type OnboardingProgress = {
  kind: OnboardingKind;
  stage: 'setup' | 'catalog' | 'nutrition' | 'plan' | 'racebook' | 'supporter';
  selectedRaceId?: string | null;
};

const PROGRESS_KEY = 'pace-yourself.mobile-onboarding-progress';
const SUPPORTER_STATUS_COLUMN = 'supporter_onboarding_status';
const LEGACY_STATUS_COLUMNS = 'plan_onboarding_status, racebook_onboarding_status';
export const ONBOARDING_STATUS_COLUMNS = `${LEGACY_STATUS_COLUMNS}, ${SUPPORTER_STATUS_COLUMN}`;
const localSupporterStatusKey = (userId: string) => `pace-yourself.supporter-onboarding-status:${userId}`;

/**
 * The supporter tour column ships with this build's migration. Until it is
 * applied (development builds share the production database, older schema
 * snapshots), reads fall back to the two runner columns and the supporter
 * status lives on the device, so the tour still works and never blocks.
 */
export function isMissingSupporterStatusColumn(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return Boolean(candidate)
    && (candidate?.code === '42703' || candidate?.code === 'PGRST204')
    && String(candidate?.message ?? '').includes(SUPPORTER_STATUS_COLUMN);
}

async function readLocalSupporterStatus(userId: string) {
  try {
    return (await AsyncStorage.getItem(localSupporterStatusKey(userId))) ?? null;
  } catch {
    return null;
  }
}

/** Reads `user_profiles` with the onboarding statuses (plus `extraColumns`), tolerating a missing supporter column. */
export async function selectProfileWithOnboardingStatuses<TRow extends Record<string, unknown>>(
  userId: string,
  extraColumns = '',
): Promise<{ data: TRow | null; error: unknown; status?: number | null }> {
  const columns = (base: string) => (extraColumns ? `${base}, ${extraColumns}` : base);
  const result = await supabase.from('user_profiles').select(columns(ONBOARDING_STATUS_COLUMNS)).eq('user_id', userId).maybeSingle();
  if (!isMissingSupporterStatusColumn(result.error)) return result as { data: TRow | null; error: unknown; status?: number | null };

  const legacy = await supabase.from('user_profiles').select(columns(LEGACY_STATUS_COLUMNS)).eq('user_id', userId).maybeSingle();
  if (legacy.error || !legacy.data) return legacy as { data: TRow | null; error: unknown; status?: number | null };
  const supporterStatus = await readLocalSupporterStatus(userId);
  return { ...legacy, data: { ...(legacy.data as TRow), [SUPPORTER_STATUS_COLUMN]: supporterStatus } };
}
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

  const { data, error } = await selectProfileWithOnboardingStatuses(resolvedUserId);

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
  if (patch.supporter) payload.supporter_onboarding_status = patch.supporter;

  let { data, error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' })
    .select(ONBOARDING_STATUS_COLUMNS)
    .single();

  if (isMissingSupporterStatusColumn(error)) {
    // Schema without the supporter column yet: keep that status on the device.
    const { [SUPPORTER_STATUS_COLUMN]: supporterStatus, ...legacyPayload } = payload;
    if (supporterStatus) await AsyncStorage.setItem(localSupporterStatusKey(userId), supporterStatus);
    const legacy = await supabase
      .from('user_profiles')
      .upsert({ user_id: userId, ...legacyPayload }, { onConflict: 'user_id' })
      .select(LEGACY_STATUS_COLUMNS)
      .single();
    error = legacy.error;
    data = legacy.data
      ? { ...(legacy.data as Record<string, unknown>), [SUPPORTER_STATUS_COLUMN]: await readLocalSupporterStatus(userId) } as typeof data
      : null;
  }

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
  const statuses = await updateStatuses({ plan: 'skipped', racebook: 'skipped', supporter: 'skipped' });
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
