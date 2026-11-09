import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { fetchFollowedEvents, type FollowedEvents } from '../lib/raceFavorites';

/**
 * Followed (favorite) events for "Mes courses", split into upcoming and past. Refreshed on focus so
 * a heart toggled in the catalog shows up immediately. Failures are silent: the
 * screen still lists the runner's plans.
 */
export function useFollowedRaces() {
  const [followedEvents, setFollowedEvents] = useState<FollowedEvents>({ upcoming: [], past: [] });

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    fetchFollowedEvents()
      .then((events) => {
        if (!cancelled) setFollowedEvents(events);
      })
      .catch((error) => {
        console.warn('Unable to load followed races.', error);
      });
    return () => {
      cancelled = true;
    };
  }, []));

  return followedEvents;
}
