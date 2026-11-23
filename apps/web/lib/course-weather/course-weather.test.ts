import { describe, expect, it } from "vitest";

import type { GpxPoint } from "../gpx/parseGpx";
import { metNorwayForecastUrl, parseMetNorwayTimeseries, type MetForecastBody } from "./met-norway";
import { selectCourseWeatherPoints } from "./points";
import {
  addCalendarDays,
  courseWeatherTimeZone,
  normalizeCourseWeatherClock,
  zonedLocalDate,
  zonedLocalTimeToUtc,
} from "./time-zone";

const iso = (date: Date | null) => date?.toISOString();

describe("course weather time zone", () => {
  it("maps countries and French overseas regions to IANA zones", () => {
    expect(courseWeatherTimeZone("FR", "84")).toBe("Europe/Paris");
    expect(courseWeatherTimeZone("FR", "04")).toBe("Indian/Reunion");
    expect(courseWeatherTimeZone(null, "01")).toBe("America/Guadeloupe");
    expect(courseWeatherTimeZone("ch", null)).toBe("Europe/Zurich");
    expect(courseWeatherTimeZone("ZZ", null)).toBe("Europe/Paris");
    expect(courseWeatherTimeZone(null, null)).toBe("Europe/Paris");
  });

  it("converts local start times to UTC across daylight saving time", () => {
    expect(iso(zonedLocalTimeToUtc("2026-07-12", "07:00", "Europe/Paris"))).toBe("2026-07-12T05:00:00.000Z");
    expect(iso(zonedLocalTimeToUtc("2026-12-06", "7h30", "Europe/Paris"))).toBe("2026-12-06T06:30:00.000Z");
    expect(iso(zonedLocalTimeToUtc("2026-10-18", "05:00", "Indian/Reunion"))).toBe("2026-10-18T01:00:00.000Z");
    // Day of the spring change, before and after it.
    expect(iso(zonedLocalTimeToUtc("2026-03-29", "01:30", "Europe/Paris"))).toBe("2026-03-29T00:30:00.000Z");
    expect(iso(zonedLocalTimeToUtc("2026-03-29", "08:00", "Europe/Paris"))).toBe("2026-03-29T06:00:00.000Z");
    // Skipped wall clock (02:30 does not exist) resolves one hour later.
    expect(iso(zonedLocalTimeToUtc("2026-03-29", "02:30", "Europe/Paris"))).toBe("2026-03-29T01:30:00.000Z");
    // Ambiguous wall clock resolves to its first occurrence (still summer time).
    expect(iso(zonedLocalTimeToUtc("2026-10-25", "02:30", "Europe/Paris"))).toBe("2026-10-25T00:30:00.000Z");
    expect(zonedLocalTimeToUtc("2026-07-12", "late", "Europe/Paris")).toBeNull();
  });

  it("reads local dates and clock texts", () => {
    expect(zonedLocalDate(new Date("2026-11-22T23:30:00Z"), "Europe/Paris")).toBe("2026-11-23");
    expect(zonedLocalDate(new Date("2026-11-22T21:30:00Z"), "Indian/Reunion")).toBe("2026-11-23");
    expect(addCalendarDays("2026-12-01", -9)).toBe("2026-11-22");
    expect(normalizeCourseWeatherClock("07:00:00")).toBe("07:00");
    expect(normalizeCourseWeatherClock("8h")).toBe("08:00");
    expect(normalizeCourseWeatherClock("25:00")).toBeNull();
  });
});

describe("MET Norway parser", () => {
  const body: MetForecastBody = {
    properties: {
      timeseries: [
        {
          time: "2026-11-29T06:00:00Z",
          data: {
            instant: { details: { air_temperature: 2, wind_speed: 5, wind_speed_of_gust: 10, wind_from_direction: 350, relative_humidity: 80, cloud_area_fraction: 90 } },
            next_1_hours: { summary: { symbol_code: "cloudy" }, details: { precipitation_amount: 0, probability_of_precipitation: 10 } },
            next_6_hours: { summary: { symbol_code: "lightrain" }, details: { precipitation_amount: 3 } },
          },
        },
        {
          time: "2026-11-29T07:00:00Z",
          data: {
            instant: { details: { air_temperature: 3, wind_speed: 6, wind_from_direction: 10, relative_humidity: 82, cloud_area_fraction: 100 } },
            next_1_hours: { summary: { symbol_code: "lightrain" }, details: { precipitation_amount: 0.4 } },
            next_6_hours: { summary: { symbol_code: "rain" }, details: { precipitation_amount: 6 } },
          },
        },
        {
          // Last hourly-looking step: the next step is 6 h later, so the 6-hour period applies.
          time: "2026-11-29T08:00:00Z",
          data: {
            instant: { details: { air_temperature: 4, wind_speed: 0, wind_from_direction: 340, relative_humidity: 80, cloud_area_fraction: 50 } },
            next_1_hours: { summary: { symbol_code: "cloudy" }, details: { precipitation_amount: 0 } },
            next_6_hours: { summary: { symbol_code: "heavyrain" }, details: { precipitation_amount: 12, probability_of_precipitation: 70 } },
          },
        },
        {
          time: "2026-11-29T14:00:00Z",
          data: {
            instant: { details: { air_temperature: 10, wind_speed: 6, wind_from_direction: 20, relative_humidity: 50, cloud_area_fraction: 20 } },
            next_6_hours: { summary: { symbol_code: "fair_day" }, details: { precipitation_amount: 0 } },
          },
        },
      ],
    },
  };

  it("maps hourly steps and expands 6-hour steps to hours", () => {
    const hours = parseMetNorwayTimeseries(body, {
      start: new Date("2026-11-29T07:00:00Z"),
      end: new Date("2026-11-29T14:00:00Z"),
    });
    expect(hours.map((hour) => hour.time)).toEqual([
      "2026-11-29T07:00:00Z", "2026-11-29T08:00:00Z", "2026-11-29T09:00:00Z", "2026-11-29T10:00:00Z",
      "2026-11-29T11:00:00Z", "2026-11-29T12:00:00Z", "2026-11-29T13:00:00Z", "2026-11-29T14:00:00Z",
    ]);
    expect(hours[0]).toEqual({
      time: "2026-11-29T07:00:00Z",
      temperatureC: 3,
      windSpeedKph: 21.6,
      windGustKph: null,
      windFromDeg: 10,
      precipitationMm: 0.4,
      precipitationProbability: null,
      relativeHumidity: 82,
      cloudCover: 100,
      symbol: "lightrain",
    });
    const elevenOClock = hours[4];
    expect(elevenOClock.temperatureC).toBe(7);
    expect(elevenOClock.windSpeedKph).toBe(10.8);
    // 340° → 20° through north, not through south.
    expect(elevenOClock.windFromDeg).toBe(0);
    expect(elevenOClock.precipitationMm).toBe(2);
    expect(elevenOClock.precipitationProbability).toBe(70);
    expect(elevenOClock.symbol).toBe("heavyrain");
    expect(hours[7]).toMatchObject({ temperatureC: 10, symbol: "fair_day", precipitationMm: 0 });
  });

  it("builds MET point URLs with 4 decimals and an integer altitude", () => {
    expect(metNorwayForecastUrl({ latitude: 45.123456, longitude: 6.98765, altitudeM: 1234.6 })).toBe(
      "https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=45.1235&lon=6.9877&altitude=1235",
    );
  });
});

describe("course weather points", () => {
  // Straight 30 km track heading north, highest point at km 21.
  const track: GpxPoint[] = Array.from({ length: 31 }, (_, km) => ({
    lat: 45 + km * 0.009,
    lng: 6,
    ele: km <= 21 ? 1000 + km * 50 : 2050 - (km - 21) * 100,
    distKmCum: km,
  }));

  it("projects aid stations, adds a distinct summit and finish", () => {
    const points = selectCourseWeatherPoints({
      track,
      aidStations: [
        { name: "Col", km: 10.5, orderIndex: 1 },
        { name: "Arrivée", km: 30, orderIndex: 3 },
        { name: "Refuge", km: 15, orderIndex: 2 },
      ],
      finishDistanceKm: 30,
    });
    expect(points.map((point) => point.id)).toEqual(["start", "aid-1", "aid-2", "summit", "finish"]);
    expect(points[1]).toMatchObject({ name: "Col", distanceKm: 10.5, latitude: 45.0945, longitude: 6, altitudeM: 1525 });
    expect(points[3]).toMatchObject({ kind: "summit", distanceKm: 21, altitudeM: 2050 });
  });

  it("drops a summit close to an aid station and caps the point count", () => {
    const aidStations = Array.from({ length: 28 }, (_, index) => ({ name: `R${index + 1}`, km: index + 1, orderIndex: index }));
    const points = selectCourseWeatherPoints({ track, aidStations, finishDistanceKm: 30 });
    expect(points).toHaveLength(15);
    expect(points.some((point) => point.kind === "summit")).toBe(false);
    expect(points[0].id).toBe("start");
    expect(points[1].name).toBe("R1");
    expect(points.at(-2)?.name).toBe("R28");
    expect(points.at(-1)?.id).toBe("finish");
  });
});
