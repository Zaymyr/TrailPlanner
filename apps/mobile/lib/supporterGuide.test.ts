import { describe, expect, it } from 'vitest';

import {
  availableGuideKinds,
  buildGuideAccessPresentation,
  filterGuideTimeline,
  formatCountdown,
  isStopClosed,
  resolveDayLiveState,
  resolveFormatColors,
  resolveGuideStops,
  countGuideDays,
  formatGuideClock,
  formatGuideDateRange,
  formatGuideDay,
  groupGuideTimelineByDay,
  resolveGuideTimeline,
  toRacebookSupporterPoints,
  type SupporterGuideTimelineEntry,
} from './supporterGuide';

const entry = (id: string, date: string, time: string, raceId = 'ultra'): SupporterGuideTimelineEntry => ({
  id, raceId, raceName: raceId, kind: 'start', date, time, label: null, location: null,
});

describe('Supporter Guide presentation', () => {
  it('formats edition dates as a localized range and counts its days', () => {
    expect(formatGuideDateRange('2026-11-13', '2026-11-15', 'fr')).toBe('13 – 15 nov. 2026');
    expect(formatGuideDateRange('2026-11-13', '2026-11-13', 'fr')).toBe('13 nov. 2026');
    expect(countGuideDays('2026-11-13', '2026-11-15')).toBe(3);
    expect(formatGuideDay('2026-11-13', 'fr')).toBe('Vendredi 13 novembre');
  });

  it('prefixes a cutoff on another day with its weekday, never a truncated label', () => {
    expect(formatGuideClock({ date: '2026-11-13', time: '15:00', dayOffset: 0 }, '2026-11-13', 'fr')).toBe('15:00');
    expect(formatGuideClock({ date: '2026-11-14', time: '01:00', dayOffset: 1 }, '2026-11-13', 'fr')).toBe('sam. 01:00');
    expect(formatGuideClock(null, '2026-11-13', 'fr')).toBeNull();
  });

  it('groups the sorted programme by day and filters one race', () => {
    const timeline = [entry('a', '2026-11-13', '14:00'), entry('b', '2026-11-14', '09:00', 'court'), entry('c', '2026-11-14', '12:00')];
    expect(groupGuideTimelineByDay(timeline).map((day) => [day.date, day.entries.length])).toEqual([['2026-11-13', 1], ['2026-11-14', 2]]);
    expect(groupGuideTimelineByDay(timeline, 'court').map((day) => day.entries.map((item) => item.id))).toEqual([['b']]);
  });

  it('rebuilds a chronological programme for an older API response', () => {
    const timeline = resolveGuideTimeline({
      formats: [
        { raceId: 'b', name: 'B', date: '2026-11-15', distanceKm: 35, startTime: '10:00', finishCutoffTime: null, startWaves: [], awards: [], supporterPoints: [], aidStations: [] },
        { raceId: 'c', name: 'C', date: '2026-11-15', distanceKm: 13, startTime: '08:30', finishCutoffTime: null, startWaves: [], awards: [], supporterPoints: [], aidStations: [] },
      ],
    });
    expect(timeline.map((item) => item.time)).toEqual(['08:30', '10:00']);
  });

  it('keeps supporter points without coordinates unroutable instead of pointing at 0,0', () => {
    const [point] = toRacebookSupporterPoints([{ id: 'p', name: 'Col', km: 4, encouragementAllowed: true, assistanceAllowed: false, accessLabel: null, accessNote: null, latitude: null, longitude: null, mapsUrl: null, planUrl: null }]);
    expect(Number.isNaN(point!.latitude)).toBe(true);
  });

  it('merges an identical start and finish like the runner RaceBook', () => {
    const presentation = buildGuideAccessPresentation({
      raceId: 'ultra', raceName: 'Ultra',
      start: { label: null, address: 'Musée de Bibracte', latitude: null, longitude: null, mapsUrl: null },
      finish: { label: null, address: 'musée de  bibracte', latitude: null, longitude: null, mapsUrl: null },
      parking: null, shuttles: 'Navette https://example.com', shuttleSchedule: '6h', roadRestrictions: null, mapUrl: null,
    }, { sameLocation: 'Même lieu', start: 'Départ', finish: 'Arrivée', importantInfo: 'Info', restrictions: 'Restrictions', parking: 'Parkings', shuttles: 'Navettes' });
    expect(presentation?.locations).toHaveLength(1);
    expect(presentation?.locations[0]?.actionUrl).toContain('google.com/maps/search');
    expect(presentation?.transportItems[0]).toMatchObject({ key: 'shuttles', schedule: '6h' });
  });
});

describe('Supporter Guide live programme', () => {
  const at = (id: string, date: string, time: string, kind: SupporterGuideTimelineEntry['kind'] = 'start', raceId = 'ultra'): SupporterGuideTimelineEntry => ({
    id, raceId, raceName: raceId, kind, date, time, label: null, location: null,
  });

  it('filters by type tab and by followed races', () => {
    const entries = [at('a', '2026-11-14', '09:00'), at('b', '2026-11-14', '17:00', 'awards'), at('c', '2026-11-15', '00:00', 'finish_cutoff', 'court')];
    expect(filterGuideTimeline(entries, 'awards', null).map((entry) => entry.id)).toEqual(['b']);
    expect(filterGuideTimeline(entries, 'arrival', null).map((entry) => entry.id)).toEqual(['c']);
    expect(filterGuideTimeline(entries, 'all', new Set(['court'])).map((entry) => entry.id)).toEqual(['c']);
    expect(availableGuideKinds(entries)).toEqual(['start', 'arrival', 'awards']);
  });

  it('keeps event-wide animations whatever races are followed and groups estimated arrivals under Arrivées', () => {
    const entries = [
      { ...at('anim', '2026-11-15', '20:00', 'animation', ''), eventWide: true, label: 'Concert' },
      { ...at('est', '2026-11-15', '15:20', 'arrival_estimate', 'ultra'), audience: 'men' as const },
      at('cut', '2026-11-15', '23:30', 'finish_cutoff', 'ultra'),
    ];
    expect(filterGuideTimeline(entries, 'all', new Set(['court'])).map((entry) => entry.id)).toEqual(['anim']);
    expect(filterGuideTimeline(entries, 'arrival', null).map((entry) => entry.id)).toEqual(['est', 'cut']);
    expect(availableGuideKinds(entries)).toEqual(['arrival', 'animations']);
  });

  it('marks past entries, the next one and the now line only on the current day', () => {
    const day = [at('a', '2026-11-14', '09:00'), at('b', '2026-11-14', '12:00'), at('c', '2026-11-14', '17:00')];
    const now = new Date(2026, 10, 14, 13, 4);
    expect(resolveDayLiveState(day, '2026-11-14', now)).toEqual({ statusById: { a: 'past', b: 'past', c: 'next' }, nowIndex: 2 });
    expect(resolveDayLiveState(day, '2026-11-15', now)).toBeNull();
    expect(formatCountdown(new Date(2026, 10, 14, 15, 45), now, 'fr')).toBe('dans 2 h 41');
    expect(formatCountdown(new Date(2026, 10, 14, 13, 30), now, 'fr')).toBe('dans 26 min');
  });

  it('closes a place once its last-runner cutoff has passed', () => {
    const now = new Date(2026, 10, 14, 21, 30);
    expect(isStopClosed({ cutoff: { date: '2026-11-14', time: '21:00', dayOffset: 0 } }, '2026-11-14', now)).toBe(true);
    expect(isStopClosed({ cutoff: { date: '2026-11-15', time: '00:00', dayOffset: 1 } }, '2026-11-14', now)).toBe(false);
    expect(isStopClosed({ cutoff: null }, '2026-11-14', now)).toBe(false);
  });

  it('falls back to one stop per row for an older API response', () => {
    const stops = resolveGuideStops({
      raceId: 'r', name: 'R', date: '2026-11-14', distanceKm: 20, startTime: '09:00', finishCutoffTime: null, startWaves: [], awards: [],
      supporterPoints: [{ id: 'p', name: 'Col', km: 5, encouragementAllowed: true, assistanceAllowed: false, accessLabel: null, accessNote: null, latitude: 1, longitude: 2, mapsUrl: null, planUrl: null }],
      aidStations: [{ id: 's', name: 'Ravito', km: 3, assistanceAllowed: true, supportersAccess: 'allowed', maxStopMinutes: null, amenities: [], cutoffTime: '11:00' }],
    });
    expect(stops.map((stop) => [stop.id, stop.aidStation])).toEqual([['s:s', true], ['p:p', false]]);
    expect(stops[0]?.cutoff).toEqual({ date: null, time: '11:00', dayOffset: 0 });
  });
});

describe('Supporter Guide format colours', () => {
  it('assigns one stable design-system colour per format by increasing distance', () => {
    const colours = resolveFormatColors([
      { raceId: 'ultra', distanceKm: 82, name: 'Ultra' },
      { raceId: 'court', distanceKm: 18, name: 'Court' },
      { raceId: 'moyen', distanceKm: 42, name: 'Moyen' },
    ]);
    expect(colours).toEqual({ court: '#2B6CB0', moyen: '#C05621', ultra: '#6B46C1' });
  });
});
