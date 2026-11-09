import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));
vi.mock('./webApi', () => ({ WEB_API_BASE_URL: 'https://example.test' }));
vi.mock('./appSession', () => ({ isAnonymousSession: () => false }));

import { selectFollowedEvents, selectUpcomingFollowedEvents } from './raceFavorites';

const NOW = new Date(2026, 10, 9, 12, 0);

type RaceSignals = { is_live: boolean; racebook_is_live: boolean; racebook_preview_is_visible?: boolean | null };

function row(id: string, race_date: string | null, races: RaceSignals[] = []) {
  return {
    id,
    name: id,
    location: null,
    race_date,
    thumbnail_url: null,
    races: races.map((race) => ({ racebook_preview_is_visible: null, ...race })),
  };
}

describe('selectUpcomingFollowedEvents', () => {
  it('keeps only upcoming followed events, soonest first', () => {
    const result = selectUpcomingFollowedEvents(
      [row('later', '2026-12-01'), row('past', '2026-11-01'), row('today', '2026-11-09'), row('soon', '2026-11-15')],
      NOW,
    );
    expect(result.map((event) => event.id)).toEqual(['today', 'soon', 'later']);
  });

  it('flags a RaceBook only for a live format with a live, visible publication', () => {
    const [published, hidden, draft] = selectUpcomingFollowedEvents(
      [
        row('a', '2026-11-10', [{ is_live: true, racebook_is_live: true }]),
        row('b', '2026-11-11', [{ is_live: true, racebook_is_live: true, racebook_preview_is_visible: false }]),
        row('c', '2026-11-12', [{ is_live: true, racebook_is_live: false }]),
      ],
      NOW,
    );
    expect(published.hasRacebook).toBe(true);
    expect(hidden.hasRacebook).toBe(false);
    expect(draft.hasRacebook).toBe(false);
  });
});

describe('selectFollowedEvents', () => {
  it('lists past followed events separately, most recent first', () => {
    const { upcoming, past } = selectFollowedEvents(
      [row('old', '2026-09-01'), row('soon', '2026-11-15'), row('recent', '2026-11-01')],
      NOW,
    );
    expect(upcoming.map((event) => event.id)).toEqual(['soon']);
    expect(past.map((event) => event.id)).toEqual(['recent', 'old']);
  });
});
