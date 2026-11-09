import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { fetchUpcomingFollowedEvents, type FollowedRaceEvent } from '../lib/raceFavorites';

/**
 * Upcoming followed (favorite) events for "Mes courses". Refreshed on focus so
 * a heart toggled in the catalog shows up immediately. Failures are silent: the
 * screen still lists the runner's plans.
 */
export function useFollowedRaces() {
  const [followedEvents, setFollowedEvents] = useState<FollowedRaceEvent[]>([]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    fetchUpcomingFollowedEvents()
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
