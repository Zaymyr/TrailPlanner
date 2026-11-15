import { describe, expect, it } from 'vitest';

import {
  buildGuideAccessPresentation,
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
