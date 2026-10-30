import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import {
  acknowledgeRunnerLaunchAnnouncement,
  getRunnerLaunchStorageKey,
  shouldShowRunnerLaunchAnnouncement,
} from '../lib/runnerLaunchAnnouncement';
import { WEB_API_BASE_URL } from '../lib/webApi';

const RUNNER_CONFIG_TIMEOUT_MS = 8_000;
const sessionSuppressedKeys = new Set<string>();

async function fetchRunnerLaunchEnabled(signal: AbortSignal): Promise<boolean> {
  const response = await fetchWithTimeout(
    `${WEB_API_BASE_URL}/api/runner/config`,
    { signal },
    RUNNER_CONFIG_TIMEOUT_MS,
  );
  if (!response.ok) return false;
  const payload = await response.json() as { enabled?: unknown };
  return payload.enabled === true;
}

export function useRunnerLaunchAnnouncement(userId: string | null, eligible: boolean) {
  const [visibleStorageKey, setVisibleStorageKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);
  const storageKey = userId ? getRunnerLaunchStorageKey(userId) : null;

  const checkVisibility = useCallback(async () => {
    const generation = ++requestGenerationRef.current;
    abortRef.current?.abort();
    abortRef.current = null;

    if (!eligible || !userId || !storageKey || AppState.currentState !== 'active') {
      setVisibleStorageKey(null);
      return;
    }
    if (sessionSuppressedKeys.has(storageKey)) {
      setVisibleStorageKey(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const shouldShow = await shouldShowRunnerLaunchAnnouncement({
      eligible,
      userId,
      storage: AsyncStorage,
      fetchEnabled: () => fetchRunnerLaunchEnabled(controller.signal),
    });

    if (
      controller.signal.aborted
      || generation !== requestGenerationRef.current
      || sessionSuppressedKeys.has(storageKey)
    ) {
      return;
    }
    abortRef.current = null;
    setVisibleStorageKey(shouldShow ? storageKey : null);
  }, [eligible, storageKey, userId]);

  useEffect(() => {
    void checkVisibility();
    return () => {
      requestGenerationRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [checkVisibility]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void checkVisibility();
    });
    return () => subscription.remove();
  }, [checkVisibility]);

  const dismiss = useCallback(() => {
    if (!userId || !storageKey) {
      setVisibleStorageKey(null);
      return;
    }

    sessionSuppressedKeys.add(storageKey);
    requestGenerationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setVisibleStorageKey(null);
    void acknowledgeRunnerLaunchAnnouncement(userId, AsyncStorage).then((persisted) => {
      if (!persisted) {
        console.warn('Runner launch announcement dismissal could not be persisted; suppressed for this session.');
      }
    });
  }, [storageKey, userId]);

  return {
    visible: Boolean(eligible && storageKey && visibleStorageKey === storageKey),
    dismiss,
  };
}
