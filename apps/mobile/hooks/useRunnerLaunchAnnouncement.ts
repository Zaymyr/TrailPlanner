import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  getRunnerLaunchStorageKey,
  parseRunnerLaunchPreference, shouldShowRunnerLaunchAnnouncement,
} from '../lib/runnerLaunchAnnouncement';
import { useRunnerLaunchInfo } from './useRunnerLaunchInfo';

const sessionPreferences = new Map<string, { seen: boolean }>();

export function useRunnerLaunchAnnouncement(userId: string | null, eligible: boolean) {
  const info = useRunnerLaunchInfo(userId, eligible);
  const [visibleKey, setVisibleKey] = useState<string | null>(null);
  const key = userId ? getRunnerLaunchStorageKey(userId) : null;
  useEffect(() => {
    let active = true;
    if (!key || !eligible) { setVisibleKey(null); return; }
    if (visibleKey === key) return;
    void (async () => {
      try {
        const preference = sessionPreferences.get(key)
          ?? parseRunnerLaunchPreference(await AsyncStorage.getItem(key));
        if (!active) return;
        if (!shouldShowRunnerLaunchAnnouncement(info, preference, new Date())) {
          setVisibleKey(null);
          return;
        }
        const seen = { seen: true };
        sessionPreferences.set(key, seen);
        setVisibleKey(key);
        // Mark at presentation so every exit path keeps this a one-time announcement.
        await AsyncStorage.setItem(key, JSON.stringify(seen));
      } catch { /* Fail closed on unreadable preferences; persistence is best effort. */ }
    })();
    return () => { active = false; };
  }, [eligible, info, key, visibleKey]);
  const dismiss = useCallback(() => {
    setVisibleKey(null);
    if (!key) return;
    const preference = { seen: true };
    sessionPreferences.set(key, preference);
    void AsyncStorage.setItem(key, JSON.stringify(preference)).catch(() => {
      console.warn('Launch preference saved for this session only.');
    });
  }, [key]);
  return { visible: Boolean(eligible && key && visibleKey === key && info.eligible), dismiss };
}
