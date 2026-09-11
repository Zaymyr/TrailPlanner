export const RACEBOOK_ONBOARDING_MIN_SEARCH_LENGTH = 2;

export function normalizeRacebookOnboardingSearch(query: string) {
  return query.trim().toLocaleLowerCase();
}

export function isRacebookOnboardingSearchReady(query: string) {
  return normalizeRacebookOnboardingSearch(query).length >= RACEBOOK_ONBOARDING_MIN_SEARCH_LENGTH;
}

export function getRacebookOnboardingResults<TRace, TEvent extends { races: TRace[] }>(
  events: TEvent[],
  canOpenRacebook: (race: TRace, event: TEvent) => boolean,
) {
  return events
    .map((event) => ({
      ...event,
      races: event.races.filter((race) => canOpenRacebook(race, event)),
    }))
    .filter((event) => event.races.length > 0);
}

export function getOrganizerDemoResults<
  TRace,
  TEvent extends { races: TRace[] },
>(
  events: TEvent[],
) {
  return events.filter((event) => event.races.length > 0);
}

export function mergeOrganizerCatalogEvents<
  TRace extends { id: string },
  TEvent extends { id: string; races: TRace[] },
>(publicEvents: TEvent[], organizerEvents: TEvent[]): TEvent[] {
  const merged = new Map(publicEvents.map((event) => [event.id, event]));

  for (const organizerEvent of organizerEvents) {
    const publicEvent = merged.get(organizerEvent.id);
    if (!publicEvent) {
      merged.set(organizerEvent.id, organizerEvent);
      continue;
    }

    const races = new Map(publicEvent.races.map((race) => [race.id, race]));
    for (const race of organizerEvent.races) races.set(race.id, race);
    merged.set(organizerEvent.id, { ...publicEvent, races: [...races.values()] });
  }

  return [...merged.values()];
}
