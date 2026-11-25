import { describe, expect, it } from 'vitest';

import {
  courseWeatherAtPassages,
  courseWeatherFeelsLikeC,
  courseWeatherHourAlerts,
  courseWeatherHourAt,
  courseWeatherLikelyPassageHours,
  summarizeCourseWeatherHours,
  type CourseWeatherHour,
  type CourseWeatherPoint,
} from '@trailplanner/shared';

const hour = (time: string, overrides: Partial<CourseWeatherHour> = {}): CourseWeatherHour => ({
  time,
  temperatureC: 10,
  windSpeedKph: 0,
  windGustKph: null,
  windFromDeg: null,
  precipitationMm: 0,
  precipitationProbability: null,
  relativeHumidity: 50,
  cloudCover: null,
  symbol: 'clearsky_day',
  ...overrides,
});

const point = (id: string, distanceKm: number, hours: CourseWeatherHour[]): CourseWeatherPoint => ({
  id,
  kind: id === 'start' ? 'start' : id === 'finish' ? 'finish' : 'aid_station',
  name: null,
  distanceKm,
  latitude: 45,
  longitude: 6,
  altitudeM: 1000,
  hours,
});

describe('course weather presentation', () => {
  it('picks the hour containing the instant, or the nearest within tolerance', () => {
    const p = point('start', 0, [hour('2026-11-29T07:00:00Z'), hour('2026-11-29T08:00:00Z', { temperatureC: 12 })]);
    expect(courseWeatherHourAt(p, '2026-11-29T08:30:00Z')?.temperatureC).toBe(12);
    expect(courseWeatherHourAt(p, '2026-11-29T10:00:00Z')?.temperatureC).toBe(12);
    expect(courseWeatherHourAt(p, '2026-11-29T12:00:00Z')).toBeNull();
  });

  it('computes wind chill and heat index', () => {
    expect(courseWeatherFeelsLikeC({ temperatureC: 0, windSpeedKph: 30, relativeHumidity: 80 })).toBeCloseTo(-6.5, 0);
    expect(courseWeatherFeelsLikeC({ temperatureC: 32, windSpeedKph: 5, relativeHumidity: 60 })).toBeGreaterThan(35);
    expect(courseWeatherFeelsLikeC({ temperatureC: 15, windSpeedKph: 20, relativeHumidity: 60 })).toBe(15);
  });

  it('raises alerts', () => {
    expect(courseWeatherHourAlerts(hour('x', { temperatureC: 33, relativeHumidity: 60 }))).toContain('heat');
    expect(courseWeatherHourAlerts(hour('x', { windGustKph: 75 }))).toContain('wind');
    expect(courseWeatherHourAlerts(hour('x', { windGustKph: null, windSpeedKph: 45 }))).toContain('wind');
    expect(courseWeatherHourAlerts(hour('x', { windGustKph: 50, windSpeedKph: 45 }))).not.toContain('wind');
    expect(courseWeatherHourAlerts(hour('x', { symbol: 'heavyrainandthunder' }))).toEqual(['storm', 'rain']);
    expect(courseWeatherHourAlerts(hour('x', { symbol: 'lightsnow', temperatureC: -2 }))).toEqual(['cold', 'snow']);
  });

  it('summarizes hours with the most severe symbol', () => {
    const summary = summarizeCourseWeatherHours([
      hour('a', { temperatureC: 4, precipitationMm: 0.4, symbol: 'cloudy' }),
      hour('b', { temperatureC: 9, precipitationMm: 1.2, windGustKph: 40, symbol: 'rain' }),
    ]);
    expect(summary).toMatchObject({ minTemperatureC: 4, maxTemperatureC: 9, maxWindGustKph: 40, totalPrecipitationMm: 1.6, dominantSymbol: 'rain' });
  });

  it('keeps only the hours the field is likely to pass a point', () => {
    const hours = Array.from({ length: 48 }, (_, i) =>
      hour(new Date(Date.parse('2026-11-28T20:00:00Z') + i * 3_600_000).toISOString().replace('.000Z', 'Z')),
    );
    const start = '2026-11-28T22:30:00Z';
    // 40 km: fastest 12 km/h → 01:50, slowest 4 km/h → 08:30 (+1 h margin) the next day.
    const likely = courseWeatherLikelyPassageHours({ distanceKm: 40, hours }, start);
    expect(likely[0].time).toBe('2026-11-29T01:00:00Z');
    expect(likely.at(-1)?.time).toBe('2026-11-29T09:00:00Z');
    expect(courseWeatherLikelyPassageHours({ distanceKm: 40, hours }, null)).toHaveLength(48);
  });

  it('places each passage on the nearest point at start + elapsed time', () => {
    const forecast = {
      startAt: '2026-11-29T07:00:00Z',
      points: [
        point('start', 0, [hour('2026-11-29T07:00:00Z', { temperatureC: 2 })]),
        point('aid-1', 21, [hour('2026-11-29T09:00:00Z', { temperatureC: 6 }), hour('2026-11-29T10:00:00Z', { temperatureC: 8 })]),
      ],
    };
    const [first, second] = courseWeatherAtPassages(forecast, [
      { distanceKm: 0, elapsedMinutes: 0 },
      { distanceKm: 20, elapsedMinutes: 190 },
    ]);
    expect(first.hour?.temperatureC).toBe(2);
    expect(second.point.id).toBe('aid-1');
    expect(second.at).toBe('2026-11-29T10:10:00.000Z');
    expect(second.hour?.temperatureC).toBe(8);
    expect(courseWeatherAtPassages({ startAt: null, points: forecast.points }, [{ distanceKm: 0, elapsedMinutes: 0 }])).toEqual([]);
  });
});
