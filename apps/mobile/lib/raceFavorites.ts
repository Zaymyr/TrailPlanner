import { isAnonymousSession } from './appSession';
import { getCatalogEventEndDate, isCatalogEventPast } from './catalogVisibility';
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
    race_date?: string | null;
    is_live: boolean | null;
    racebook_is_live: boolean | null;
    racebook_preview_is_visible: boolean | null;
  }[] | null;
};

function eventTime(event: FollowedRaceEvent) {
  return event.race_date ? new Date(event.race_date).getTime() : Number.MAX_SAFE_INTEGER;
}

/**
 * Followed events split for "Mes courses": upcoming ones soonest first, then
 * past ones (shown below in a "Courses passées" group) most recent first.
 */
export function selectFollowedEvents(rows: FollowedRaceEventRow[], now = new Date()) {
  const events = rows.map((row) => toFollowedEvent(row));
  const endDates = new Map(rows.map((row) => [row.id, getCatalogEventEndDate(row)]));
  const isPast = (event: FollowedRaceEvent) => isCatalogEventPast(endDates.get(event.id) ?? event.race_date, now);
  const upcoming = events
    .filter((event) => !isPast(event))
    .sort((left, right) => eventTime(left) - eventTime(right) || left.name.localeCompare(right.name));
  const past = events
    .filter((event) => isPast(event))
    .sort((left, right) => eventTime(right) - eventTime(left) || left.name.localeCompare(right.name));
  return { upcoming, past };
}

/** Upcoming followed events, soonest first. */
export function selectUpcomingFollowedEvents(rows: FollowedRaceEventRow[], now = new Date()): FollowedRaceEvent[] {
  return selectFollowedEvents(rows, now).upcoming;
}

function toFollowedEvent(row: FollowedRaceEventRow): FollowedRaceEvent {
  return {
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
  };
}

export type FollowedEvents = { upcoming: FollowedRaceEvent[]; past: FollowedRaceEvent[] };

export async function fetchFollowedEvents(): Promise<FollowedEvents> {
  const eventIds = await fetchRaceFavoriteEventIds();
  if (eventIds.length === 0) return { upcoming: [], past: [] };

  const { data, error } = await supabase
    .from('race_events')
    .select('id,name,location,race_date,thumbnail_url,races(race_date,is_live,racebook_is_live,racebook_preview_is_visible)')
    .in('id', eventIds)
    .eq('is_live', true);

  if (error) throw error;
  return selectFollowedEvents((data as FollowedRaceEventRow[] | null) ?? []);
}
