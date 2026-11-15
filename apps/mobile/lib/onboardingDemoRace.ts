/**
 * Demo race offered to runners who do not have a race yet during the guided
 * RaceBook onboarding.
 *
 * `Trail TST` is the public showcase fixture seeded by
 * `supabase/migrations/20260827093348_seed_trail_tst_demo_event.sql`. The
 * schema has no demo/test flag, so the event is identified by its fixed
 * migration ids, which the database docs require to stay stable
 * (docs/02-database/migrations.md).
 */
export const ONBOARDING_DEMO_EVENT_ID = '7a110000-0000-4000-8000-000000000001';

/** Shortest Trail TST format (TST 18 – Balcon des Érables): the quickest Livret to explore. */
export const ONBOARDING_DEMO_PREFERRED_RACE_ID = '7a110000-0000-4000-8000-000000000018';

type DemoRaceCandidate = { id: string; distance_km: number | null };
type DemoEventCandidate = { id: string; races: DemoRaceCandidate[] };

/**
 * Finds the demo event in already loaded catalog data and picks the format to
 * open: the preferred TST 18 when its RaceBook can be opened, otherwise the
 * shortest openable format. Returns null when the demo is not available, so
 * the caller simply hides the demo shortcut.
 */
export function resolveOnboardingDemoRace<TEvent extends DemoEventCandidate>(
  events: TEvent[],
  canOpenRacebook: (race: TEvent['races'][number], event: TEvent) => boolean,
): { event: TEvent; race: TEvent['races'][number] } | null {
  const event = events.find((candidate) => candidate.id === ONBOARDING_DEMO_EVENT_ID);
  if (!event) return null;

  const openable = event.races.filter((race) => canOpenRacebook(race, event));
  if (openable.length === 0) return null;

  const preferred = openable.find((race) => race.id === ONBOARDING_DEMO_PREFERRED_RACE_ID);
  if (preferred) return { event, race: preferred };

  const shortest = [...openable].sort((left, right) => (
    (left.distance_km ?? Number.POSITIVE_INFINITY) - (right.distance_km ?? Number.POSITIVE_INFINITY)
  ))[0];
  return shortest ? { event, race: shortest } : null;
}
