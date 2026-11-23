import { describe, expect, it, vi } from 'vitest';

import {
  buildCourseWeatherPassageLines,
  buildCourseWeatherPointRows,
  buildCourseWeatherUrl,
  courseWeatherIconName,
  courseWeatherRefreshAt,
  fetchCourseWeather,
  formatCourseWeatherClock,
  formatCourseWeatherRange,
  isCourseWeatherEntryFresh,
  isCourseWeatherResponse,
  resolveCourseWeatherRefresh,
  selectCourseWeatherDisplay,
  type CourseWeatherEntry,
} from './courseWeather';
import type { CourseWeatherForecast, CourseWeatherHour } from './courseWeatherShared';

const hour = (time: string, overrides: Partial<CourseWeatherHour> = {}): CourseWeatherHour => ({
  time,
  temperatureC: 8,
  windSpeedKph: 10,
  windGustKph: 20,
  windFromDeg: 270,
  precipitationMm: 0,
  precipitationProbability: 5,
  relativeHumidity: 70,
  cloudCover: 40,
  symbol: 'partlycloudy_day',
  ...overrides,
});

const forecast: CourseWeatherForecast = {
  status: 'forecast',
  raceId: 'race-1',
  raceDate: '2026-11-29',
  startAt: '2026-11-29T06:00:00Z',
  startTimeIsEstimated: false,
  timeZone: 'Europe/Paris',
  windowStart: '2026-11-29T06:00:00Z',
  windowEnd: '2026-11-29T09:00:00Z',
  fetchedAt: '2026-11-23T20:00:00Z',
  expiresAt: '2026-11-23T20:30:00Z',
  source: { provider: 'met_norway', attribution: 'Données météo : MET Norway (CC BY 4.0)', url: 'https://api.met.no' },
  points: [
    {
      id: 'start', kind: 'start', name: null, distanceKm: 0, latitude: 45, longitude: 6, altitudeM: 500,
      hours: [
        hour('2026-11-29T06:00:00Z', { temperatureC: 2, windSpeedKph: 20, symbol: 'clearsky_night' }),
        hour('2026-11-29T07:00:00Z', { temperatureC: 4 }),
      ],
    },
    {
      id: 'aid-1', kind: 'aid_station', name: 'Col du Lac', distanceKm: 12, latitude: 45.1, longitude: 6.1, altitudeM: 1800,
      hours: [
        hour('2026-11-29T07:00:00Z', { temperatureC: -1, windGustKph: 70, symbol: 'lightsnow' }),
        hour('2026-11-29T08:00:00Z', { temperatureC: 0, symbol: 'heavyrainandthunder', precipitationMm: 3 }),
      ],
    },
    {
      id: 'finish', kind: 'finish', name: null, distanceKm: 25, latitude: 45.2, longitude: 6.2, altitudeM: 600,
      hours: [hour('2026-11-29T09:00:00Z', { temperatureC: 9 })],
    },
  ],
};

describe('courseWeatherIconName', () => {
  it('maps MET Norway symbols to existing Ionicons glyphs', () => {
    expect(courseWeatherIconName('clearsky_day')).toBe('sunny-outline');
    expect(courseWeatherIconName('clearsky_night')).toBe('moon-outline');
    expect(courseWeatherIconName('fair_night')).toBe('cloudy-night-outline');
    expect(courseWeatherIconName('partlycloudy_day')).toBe('partly-sunny-outline');
    expect(courseWeatherIconName('cloudy')).toBe('cloudy-outline');
    expect(courseWeatherIconName('fog')).toBe('cloud-outline');
    expect(courseWeatherIconName('lightrainshowers_day')).toBe('rainy-outline');
    expect(courseWeatherIconName('sleet')).toBe('snow-outline');
    expect(courseWeatherIconName('heavyrainandthunder')).toBe('thunderstorm-outline');
    expect(courseWeatherIconName(null)).toBe('cloud-outline');
  });
});

describe('buildCourseWeatherPointRows', () => {
  it('summarizes each point over the race window with ordered alerts', () => {
    const rows = buildCourseWeatherPointRows(forecast);
    expect(rows.map((row) => row.id)).toEqual(['start', 'aid-1', 'finish']);
    expect(rows[0]).toMatchObject({ icon: 'partly-sunny-outline', summary: { minTemperatureC: 2, maxTemperatureC: 4 } });
    expect(rows[0].minFeelsLikeC).toBeLessThan(2);
    expect(rows[1].icon).toBe('thunderstorm-outline');
    expect(rows[1].alerts).toEqual(['storm', 'snow', 'wind', 'rain', 'cold']);
    expect(rows[2].alerts).toEqual([]);
  });
});

describe('buildCourseWeatherPassageLines', () => {
  const checkpoints = [
    { index: 0, distanceKm: 0, arrivalMinute: 0 },
    { index: 1, distanceKm: 12.4, arrivalMinute: 90 },
    { index: 2, distanceKm: 25, arrivalMinute: 600 },
  ];

  it('uses the runner departure and the planned elapsed minutes', () => {
    const lines = buildCourseWeatherPassageLines(forecast, checkpoints, new Date('2026-11-29T06:00:00Z'));
    expect(lines.get(0)?.hour?.time).toBe('2026-11-29T06:00:00Z');
    expect(lines.get(1)).toMatchObject({ at: '2026-11-29T07:30:00.000Z', icon: 'snow-outline' });
    expect(lines.get(1)?.alerts).toEqual(['snow', 'wind', 'cold']);
    // 16:00 is far outside the finish forecast hours.
    expect(lines.get(2)?.hour).toBeNull();
  });

  it('follows a later manual departure', () => {
    const lines = buildCourseWeatherPassageLines(forecast, checkpoints, '2026-11-29T07:00:00Z');
    expect(lines.get(0)?.hour?.time).toBe('2026-11-29T07:00:00Z');
  });

  it('returns nothing without departure', () => {
    expect(buildCourseWeatherPassageLines(forecast, checkpoints, null).size).toBe(0);
  });
});

describe('cache freshness', () => {
  const entry: CourseWeatherEntry = { response: forecast, savedAt: '2026-11-23T20:00:00Z' };

  it('never refetches a forecast before expiresAt (with a 15 min floor)', () => {
    expect(courseWeatherRefreshAt(entry)).toBe(Date.parse('2026-11-23T20:30:00Z'));
    expect(isCourseWeatherEntryFresh(entry, new Date('2026-11-23T20:29:00Z'))).toBe(true);
    expect(isCourseWeatherEntryFresh(entry, new Date('2026-11-23T20:31:00Z'))).toBe(false);
    const expiredAtOnce = { ...entry, response: { ...forecast, expiresAt: '2026-11-23T19:00:00Z' } };
    expect(isCourseWeatherEntryFresh(expiredAtOnce, new Date('2026-11-23T20:10:00Z'))).toBe(true);
  });

  it('re-asks a too-early answer when its availability day starts', () => {
    const tooEarly: CourseWeatherEntry = {
      response: { status: 'too_early', raceId: 'race-1', raceDate: '2026-12-20', availableFrom: '2026-11-24' },
      savedAt: '2026-11-23T22:00:00Z',
    };
    expect(courseWeatherRefreshAt(tooEarly)).toBe(Date.parse('2026-11-24T00:00:00Z'));
  });
});

describe('resolveCourseWeatherRefresh', () => {
  const now = new Date('2026-11-24T08:00:00Z');
  const previous: CourseWeatherEntry = { response: forecast, savedAt: '2026-11-23T20:00:00Z' };

  it('keeps the last good forecast when the network fails', () => {
    expect(resolveCourseWeatherRefresh(previous, { kind: 'unreachable' }, now)).toEqual({ entry: previous, stale: true, persist: 'keep' });
    expect(resolveCourseWeatherRefresh(null, { kind: 'unreachable' }, now)).toEqual({ entry: null, stale: false, persist: 'keep' });
  });

  it('keeps the last forecast on a provider error', () => {
    const result = resolveCourseWeatherRefresh(previous, { kind: 'ok', response: { status: 'unavailable', raceId: 'race-1', reason: 'provider_error' } }, now);
    expect(result).toEqual({ entry: previous, stale: true, persist: 'keep' });
  });

  it('drops the copy on an authoritative refusal', () => {
    expect(resolveCourseWeatherRefresh(previous, { kind: 'gone' }, now).persist).toBe('remove');
    const past = resolveCourseWeatherRefresh(previous, { kind: 'ok', response: { status: 'unavailable', raceId: 'race-1', reason: 'past' } }, now);
    expect(past.persist).toBe('remove');
    expect(selectCourseWeatherDisplay(past.entry, now)).toEqual({ kind: 'hidden' });
  });

  it('writes a fresh forecast stamped with the load time', () => {
    const result = resolveCourseWeatherRefresh(previous, { kind: 'ok', response: forecast }, now);
    expect(result).toMatchObject({ stale: false, persist: 'write', entry: { savedAt: now.toISOString() } });
  });
});

describe('selectCourseWeatherDisplay', () => {
  it('selects the card state', () => {
    expect(selectCourseWeatherDisplay(null)).toEqual({ kind: 'hidden' });
    expect(selectCourseWeatherDisplay({
      response: { status: 'too_early', raceId: 'r', raceDate: '2026-12-20', availableFrom: '2026-12-11' },
      savedAt: '2026-11-23T20:00:00Z',
    })).toEqual({ kind: 'too_early', availableFrom: '2026-12-11' });
    const entry = { response: forecast, savedAt: '2026-11-23T20:00:00Z' };
    expect(selectCourseWeatherDisplay(entry, new Date('2026-11-29T12:00:00Z')).kind).toBe('forecast');
    expect(selectCourseWeatherDisplay(entry, new Date('2026-12-02T12:00:00Z')).kind).toBe('hidden');
  });
});

describe('fetchCourseWeather', () => {
  const respond = (status: number, body: unknown) =>
    vi.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300, json: async () => body });

  it('classifies answers', async () => {
    expect(await fetchCourseWeather('race-1', respond(200, forecast) as unknown as typeof fetch)).toEqual({ kind: 'ok', response: forecast });
    expect(await fetchCourseWeather('race-1', respond(404, {}) as unknown as typeof fetch)).toEqual({ kind: 'gone' });
    expect(await fetchCourseWeather('race-1', respond(503, {}) as unknown as typeof fetch)).toEqual({ kind: 'unreachable' });
    expect(await fetchCourseWeather('race-1', respond(200, { status: 'weird' }) as unknown as typeof fetch)).toEqual({ kind: 'unreachable' });
    const failing = vi.fn().mockRejectedValue(new TypeError('Network request failed'));
    expect(await fetchCourseWeather('race-1', failing as unknown as typeof fetch)).toEqual({ kind: 'unreachable' });
  });

  it('builds the endpoint URL', () => {
    expect(buildCourseWeatherUrl('a b', 'https://example.test')).toBe('https://example.test/api/race-weather?raceId=a%20b');
    expect(isCourseWeatherResponse({ status: 'unavailable', raceId: 'r', reason: 'no_route' })).toBe(true);
  });
});

describe('formatting', () => {
  it('formats local clocks in the race time zone', () => {
    expect(formatCourseWeatherClock('2026-11-29T06:00:00Z', 'Europe/Paris', 'fr')).toBe('07:00');
  });

  it('formats temperature ranges', () => {
    expect(formatCourseWeatherRange(2.4, 2.4)).toBe('2°');
    expect(formatCourseWeatherRange(-1, 9)).toBe('-1° / 9°');
    expect(formatCourseWeatherRange(null, null)).toBeNull();
  });
});

describe('missing gusts and probabilities (MET Norway over France)', () => {
  it('keeps the sustained wind and reports no gust', () => {
    const rows = buildCourseWeatherPointRows({
      points: [{
        ...forecast.points[2],
        hours: [
          hour('2026-11-29T09:00:00Z', { windSpeedKph: 18, windGustKph: null, precipitationProbability: null }),
          hour('2026-11-29T10:00:00Z', { windSpeedKph: 25, windGustKph: null, precipitationProbability: null }),
        ],
      }],
    });
    expect(rows[0]).toMatchObject({ maxWindSpeedKph: 25, maxWindGustKph: null, summary: { maxPrecipitationProbability: null } });
  });
});
