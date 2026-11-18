import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { type FollowedPlan } from '../lib/followedPlans';
import { listFollowedPlansWithOfflineCopy } from '../lib/offlineFollowedPlans';

export function useFollowedPlans() {
  const [follows, setFollows] = useState<FollowedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Save time of the device copy on screen while the network is unreachable.
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);

  const refresh = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    setError(null);
    try {
      const result = await listFollowedPlansWithOfflineCopy();
      setFollows(result.value);
      setOfflineSavedAt(result.offlineSavedAt);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'authentication_required') setFollows([]);
      else setError(cause instanceof Error ? cause.message : 'request_failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { follows, loading, refreshing, error, offlineSavedAt, refresh };
}
