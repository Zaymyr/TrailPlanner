import { isAnonymousSession } from './appSession';
import { isCatalogEventPast } from './catalogVisibility';
import { supabase } from './supabase';
import { WEB_API_BASE_URL } from './webApi';

/** Event ids the identified runner follows (catalog favorites). Guests follow nothing. */
export async function fetchRaceFavoriteEventIds() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session?.access_token || isAnonymousSession(session)) {
    return [] as string[];
  }

  const response = await fetch(`${WEB_API_BASE_URL}/api/race-favorites`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as { eventIds?: unknown } | null;
  if (!response.ok || !Array.isArray(payload?.eventIds)) {
    throw new Error('Unable to load race favorites.');
  }

  return payload.eventIds.filter((value): value is string => typeof value === 'string');
}

export type FollowedRaceEvent = {
  id: string;
  name: string;
  location: string | null;
  race_date: string | null;
  thumbnail_url: string | null;
  /** At least one live format exposes a published RaceBook. */
  hasRacebook: boolean;
};

type FollowedRaceEventRow = {
  id: string;
  name: string;
  location: string | null;
  race_date: string | null;
  thumbnail_url: string | null;
  races: {
    is_live: boolean | null;
    racebook_is_live: boolean | null;
    racebook_preview_is_visible: boolean | null;
  }[] | null;
};

/**
 * Upcoming followed events, soonest first. Past events are left to the catalog
 * retention window and to the plan history so "Mes courses" stays forward-looking.
 */
export function selectUpcomingFollowedEvents(rows: FollowedRaceEventRow[], now = new Date()): FollowedRaceEvent[] {
  return rows
    .filter((row) => !isCatalogEventPast(row.race_date, now))
    .map((row) => ({
      id: row.id,
      name: row.name,
      location: row.location,
      race_date: row.race_date,
      thumbnail_url: row.thumbnail_url,
      hasRacebook: (row.races ?? []).some((race) => (
        race.is_live === true
        && race.racebook_is_live === true
        && race.racebook_preview_is_visible !== false
      )),
    }))
    .sort((left, right) => {
      const leftTime = left.race_date ? new Date(left.race_date).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.race_date ? new Date(right.race_date).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime || left.name.localeCompare(right.name);
    });
}

export async function fetchUpcomingFollowedEvents(): Promise<FollowedRaceEvent[]> {
  const eventIds = await fetchRaceFavoriteEventIds();
  if (eventIds.length === 0) return [];

  const { data, error } = await supabase
    .from('race_events')
    .select('id,name,location,race_date,thumbnail_url,races(is_live,racebook_is_live,racebook_preview_is_visible)')
    .in('id', eventIds)
    .eq('is_live', true);

  if (error) throw error;
  return selectUpcomingFollowedEvents((data as FollowedRaceEventRow[] | null) ?? []);
}
