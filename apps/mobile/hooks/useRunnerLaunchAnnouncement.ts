import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  getRunnerLaunchDay, getRunnerLaunchStorageKey,
  parseRunnerLaunchPreference, shouldShowRunnerLaunchAnnouncement,
} from '../lib/runnerLaunchAnnouncement';
import { useRunnerLaunchInfo } from './useRunnerLaunchInfo';

const sessionPreferences = new Map<string, { hidden: boolean; lastSeenDay: string | null }>();

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
        const seen = { ...preference, lastSeenDay: getRunnerLaunchDay(new Date()) };
        sessionPreferences.set(key, seen);
        setVisibleKey(key);
        // Mark at presentation, so closing or backgrounding cannot show it twice today.
        await AsyncStorage.setItem(key, JSON.stringify(seen));
      } catch { /* Fail closed on unreadable preferences; persistence is best effort. */ }
    })();
    return () => { active = false; };
  }, [eligible, info, key, visibleKey]);
  const dismiss = useCallback((dontShowAgain = false) => {
    setVisibleKey(null);
    if (!key) return;
    const preference = {
      hidden: dontShowAgain || sessionPreferences.get(key)?.hidden === true,
      lastSeenDay: getRunnerLaunchDay(new Date()),
    };
    sessionPreferences.set(key, preference);
    void AsyncStorage.setItem(key, JSON.stringify(preference)).catch(() => {
      console.warn('Launch preference saved for this session only.');
    });
  }, [key]);
  return { visible: Boolean(eligible && key && visibleKey === key && info.eligible), dismiss };
}
