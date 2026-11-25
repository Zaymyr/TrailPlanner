import { describe, expect, it, vi } from 'vitest';

import {
  COURSE_WEATHER_POINT_MATCH_TOLERANCE_KM,
  buildCourseWeatherPassageLines,
  buildCourseWeatherPointRows,
  buildCourseWeatherRowPassages,
  buildCourseWeatherRowWindows,
  buildCourseWeatherUrl,
  courseWeatherDepartureAt,
  courseWeatherIconName,
  courseWeatherInstantAt,
  matchCourseWeatherPoint,
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

describe('matchCourseWeatherPoint', () => {
  it('prefers the point with the row id when its distance agrees', () => {
    expect(matchCourseWeatherPoint(forecast.points, { pointId: 'aid-1', distanceKm: 12 })?.id).toBe('aid-1');
    expect(matchCourseWeatherPoint(forecast.points, { pointId: 'finish', distanceKm: 25 })?.id).toBe('finish');
  });

  it('falls back to the nearest point within the tolerance (thinned or near-endpoint station)', () => {
    // `aid-7` was dropped by the 15-point thinning; `aid-1` is 0.8 km away.
    expect(matchCourseWeatherPoint(forecast.points, { pointId: 'aid-7', distanceKm: 12.8 })?.id).toBe('aid-1');
    // A station 300 m after the start is merged into the start point.
    expect(matchCourseWeatherPoint(forecast.points, { pointId: 'aid-0', distanceKm: 0.3 })?.id).toBe('start');
    expect(COURSE_WEATHER_POINT_MATCH_TOLERANCE_KM).toBe(2);
  });

  it('shows nothing when no point is close enough', () => {
    expect(matchCourseWeatherPoint(forecast.points, { pointId: 'aid-9', distanceKm: 18 })).toBeNull();
    // An id whose distance disagrees is not trusted.
    expect(matchCourseWeatherPoint(forecast.points, { pointId: 'aid-1', distanceKm: 19 })).toBeNull();
    expect(matchCourseWeatherPoint(forecast.points, { distanceKm: Number.NaN })).toBeNull();
  });
});

describe('courseWeatherInstantAt', () => {
  it('anchors a local race-day clock on the official start in the race zone', () => {
    // startAt 06:00Z = 07:00 in Paris on race day.
    expect(courseWeatherInstantAt(forecast, { time: '09:30' })?.toISOString()).toBe('2026-11-29T08:30:00.000Z');
    expect(courseWeatherInstantAt(forecast, { date: null, time: '01:00', dayOffset: 1 })?.toISOString()).toBe('2026-11-30T00:00:00.000Z');
    expect(courseWeatherInstantAt(forecast, { date: '2026-11-30', time: '01:00', dayOffset: 0 })?.toISOString()).toBe('2026-11-30T00:00:00.000Z');
  });

  it('uses the race zone, not the device one', () => {
    const newYork = { ...forecast, startAt: '2026-11-29T12:00:00Z', timeZone: 'America/New_York' };
    expect(courseWeatherInstantAt(newYork, { time: '10:00' })?.toISOString()).toBe('2026-11-29T15:00:00.000Z');
  });

  it('returns null without a usable clock or start', () => {
    expect(courseWeatherInstantAt(forecast, { time: 'midi' })).toBeNull();
    expect(courseWeatherInstantAt(forecast, null)).toBeNull();
    expect(courseWeatherInstantAt({ ...forecast, startAt: null }, { time: '09:00' })).toBeNull();
  });
});

describe('courseWeatherDepartureAt', () => {
  it('shifts the official start by the personal departure clock', () => {
    expect(courseWeatherDepartureAt(forecast, '07:30')?.toISOString()).toBe('2026-11-29T06:30:00.000Z');
    expect(courseWeatherDepartureAt(forecast, '06:40')?.toISOString()).toBe('2026-11-29T05:40:00.000Z');
  });

  it('uses the official start without a valid clock', () => {
    expect(courseWeatherDepartureAt(forecast, null)?.toISOString()).toBe('2026-11-29T06:00:00.000Z');
    expect(courseWeatherDepartureAt(forecast, 'tôt')?.toISOString()).toBe('2026-11-29T06:00:00.000Z');
    expect(courseWeatherDepartureAt({ ...forecast, startAt: null }, '07:00')).toBeNull();
  });
});

describe('buildCourseWeatherRowPassages', () => {
  const rows = [
    { key: 'start', pointId: 'start', distanceKm: 0, arrivalMinute: 0 },
    { key: 'station-a', pointId: 'aid-1', distanceKm: 12, arrivalMinute: 90 },
    { key: 'station-b', pointId: 'aid-2', distanceKm: 18, arrivalMinute: 200 },
    { key: 'station-c', pointId: 'aid-3', distanceKm: 12.5, arrivalMinute: null },
    { key: 'finish', pointId: 'finish', distanceKm: 25, arrivalMinute: 600 },
  ];

  it('places each row at departure + planned minutes; the glyph follows the passage hour', () => {
    const lines = buildCourseWeatherRowPassages(forecast, rows, new Date('2026-11-29T06:00:00Z'));
    expect(lines.start).toMatchObject({ kind: 'passage', pointId: 'start', icon: 'moon-outline', hour: { time: '2026-11-29T06:00:00Z' } });
    expect(lines['station-a']).toMatchObject({ kind: 'passage', at: '2026-11-29T07:30:00.000Z', icon: 'snow-outline', alerts: ['snow', 'wind', 'cold'] });
    // No forecast point near km 18, no planned minute, and 16:00 outside the finish hours.
    expect(Object.keys(lines)).toEqual(['start', 'station-a']);
  });

  it('follows a later departure into daylight', () => {
    const lines = buildCourseWeatherRowPassages(forecast, rows, courseWeatherDepartureAt(forecast, '08:00'));
    expect(lines.start).toMatchObject({ icon: 'partly-sunny-outline', hour: { time: '2026-11-29T07:00:00Z' } });
  });

  it('returns nothing without departure', () => {
    expect(buildCourseWeatherRowPassages(forecast, rows, null)).toEqual({});
  });
});

describe('buildCourseWeatherRowWindows', () => {
  it('summarizes the field likely passage window when no bounds are given', () => {
    const lines = buildCourseWeatherRowWindows(forecast, [
      { key: 'start', pointId: 'start', distanceKm: 0 },
      { key: 'station-a', pointId: 'aid-1', distanceKm: 12 },
      { key: 'station-b', pointId: 'aid-2', distanceKm: 18 },
    ]);
    expect(lines.start).toMatchObject({ kind: 'window', summary: { minTemperatureC: 2, maxTemperatureC: 4 } });
    // 12 km: 12 km/h − 30 min → 06:30Z, 4 km/h + 1 h → 10:00Z; clipped to the 07:00–09:00Z forecast hours.
    expect(lines['station-a']).toMatchObject({
      kind: 'window',
      from: '2026-11-29T07:00:00.000Z',
      to: '2026-11-29T09:00:00.000Z',
      icon: 'thunderstorm-outline',
      summary: { minTemperatureC: -1, maxTemperatureC: 0 },
    });
    expect(lines['station-b']).toBeUndefined();
  });

  it('uses the first expected arrival and the cutoff (Livret supporter)', () => {
    const lines = buildCourseWeatherRowWindows(forecast, [
      { key: 'col', distanceKm: 12, from: new Date('2026-11-29T08:10:00Z'), to: new Date('2026-11-29T08:50:00Z') },
      { key: 'finish', pointId: 'finish', distanceKm: 25, from: new Date('2026-11-29T09:15:00Z'), to: new Date('2026-11-29T11:00:00Z') },
      // Cutoff before the first arrival: widened to one hour.
      { key: 'odd', distanceKm: 25, from: new Date('2026-11-29T09:00:00Z'), to: new Date('2026-11-29T08:00:00Z') },
      { key: 'late', distanceKm: 25, from: new Date('2026-11-30T10:00:00Z'), to: null },
    ]);
    expect(lines.col).toMatchObject({ icon: 'thunderstorm-outline', summary: { minTemperatureC: 0, maxTemperatureC: 0 } });
    expect(lines.finish).toMatchObject({ from: '2026-11-29T09:15:00.000Z', to: '2026-11-29T10:00:00.000Z', summary: { maxTemperatureC: 9 } });
    expect(lines.odd).toMatchObject({ summary: { maxTemperatureC: 9 } });
    expect(lines.late).toBeUndefined();
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
