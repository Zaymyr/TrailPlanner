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
