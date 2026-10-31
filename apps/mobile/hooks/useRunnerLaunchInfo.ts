import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { EMPTY_RUNNER_LAUNCH, type RunnerLaunchInfo } from '../lib/runnerLaunchAnnouncement';
import { WEB_API_BASE_URL } from '../lib/webApi';

export function useRunnerLaunchInfo(userId: string | null, enabled = true) {
  const [result, setResult] = useState<{ userId: string; info: RunnerLaunchInfo } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  useEffect(() => {
    if (!userId || !enabled) return;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active || data.session?.user.id !== userId) return;
        const response = await fetchWithTimeout(`${WEB_API_BASE_URL}/api/runner/launch`, {
          headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: controller.signal,
        }, 8_000);
        if (!response.ok) throw new Error('Launch status unavailable');
        const info = await response.json() as RunnerLaunchInfo;
        if (active) setResult({ userId, info });
      } catch {
        if (active) setResult({ userId, info: EMPTY_RUNNER_LAUNCH });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [enabled, refresh, userId]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') reload(); });
    return () => listener.remove();
  }, [reload]);
  return result?.userId === userId && enabled ? result.info : EMPTY_RUNNER_LAUNCH;
}
