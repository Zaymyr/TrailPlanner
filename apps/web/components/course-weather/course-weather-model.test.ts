import type { CourseWeatherForecast, CourseWeatherHour } from "@trailplanner/shared";
import { describe, expect, it } from "vitest";

import {
  buildPassageRows,
  buildRaceDayRows,
  formatLocalDay,
  formatLocalTime,
  passagesFromPlanSegments,
  selectCourseWeatherView,
  startEstimateNote,
  weatherGlyphForSymbol,
} from "./course-weather-model";

const hour = (time: string, overrides: Partial<CourseWeatherHour> = {}): CourseWeatherHour => ({
  time,
  temperatureC: 10,
  windSpeedKph: 12,
  windGustKph: 20,
  windFromDeg: 180,
  precipitationMm: 0,
  precipitationProbability: 10,
  relativeHumidity: 60,
  cloudCover: 40,
  symbol: "partlycloudy_day",
  ...overrides,
});

// Race on 2026-11-29 in Paris (UTC+1): 07:00 local = 06:00Z.
const forecast: CourseWeatherForecast = {
  status: "forecast",
  raceId: "race-1",
  raceDate: "2026-11-29",
  startAt: "2026-11-29T06:00:00Z",
  startTimeIsEstimated: true,
  timeZone: "Europe/Paris",
  windowStart: "2026-11-29T06:00:00Z",
  windowEnd: "2026-11-29T12:00:00Z",
  fetchedAt: "2026-11-23T13:05:00Z",
  expiresAt: "2026-11-23T14:05:00Z",
  source: { provider: "met_norway", attribution: "Données météo : MET Norway (CC BY 4.0)", url: "https://api.met.no/" },
  points: [
    {
      id: "start",
      kind: "start",
      name: null,
      distanceKm: 0,
      latitude: 45,
      longitude: 6,
      altitudeM: 1000,
      hours: [hour("2026-11-29T06:00:00Z", { temperatureC: 2 }), hour("2026-11-29T07:00:00Z", { temperatureC: 4 })],
    },
    {
      id: "aid-1",
      kind: "aid_station",
      name: "Refuge du Col",
      distanceKm: 12,
      latitude: 45.1,
      longitude: 6.1,
      altitudeM: 2000,
      hours: [
        hour("2026-11-29T08:00:00Z", { temperatureC: -3, windSpeedKph: 30, windGustKph: 70, symbol: "snow" }),
        hour("2026-11-29T09:00:00Z", { temperatureC: -2, precipitationMm: 1.5, symbol: "heavysnowshowers_day" }),
      ],
    },
    {
      id: "finish",
      kind: "finish",
      name: null,
      distanceKm: 24,
      latitude: 45.2,
      longitude: 6.2,
      altitudeM: 900,
      hours: [hour("2026-11-29T10:00:00Z", { symbol: "lightrain", precipitationMm: 0.4 })],
    },
  ],
};

describe("weatherGlyphForSymbol", () => {
  it.each([
    ["clearsky_day", "clear"],
    ["fair_night", "partly_night"],
    ["clearsky_night", "clear_night"],
    ["partlycloudy_day", "partly"],
    ["cloudy", "cloudy"],
    ["fog", "fog"],
    ["lightrain", "rain"],
    ["heavyrainshowers_day", "rain"],
    ["sleet", "snow"],
    ["lightsnowandthunder", "storm"],
    ["heavyrainandthunder", "storm"],
    ["snow", "snow"],
    ["something_new", "unknown"],
    [null, "unknown"],
  ])("maps %s to %s", (symbol, glyph) => {
    expect(weatherGlyphForSymbol(symbol)).toBe(glyph);
  });
});

describe("selectCourseWeatherView", () => {
  it("selects a state from the query", () => {
    expect(selectCourseWeatherView({ status: "idle", data: null }).kind).toBe("hidden");
    expect(selectCourseWeatherView({ status: "loading", data: null }).kind).toBe("loading");
    expect(selectCourseWeatherView({ status: "error", data: null }).kind).toBe("error");
    expect(selectCourseWeatherView({ status: "ready", data: forecast }).kind).toBe("forecast");
    expect(
      selectCourseWeatherView({ status: "ready", data: { status: "too_early", raceId: "r", raceDate: "2026-12-20", availableFrom: "2026-12-11" } }),
    ).toEqual({ kind: "too_early", availableFrom: "2026-12-11" });
  });

  it("renders nothing for unavailable, except a discreet line for a provider error", () => {
    expect(selectCourseWeatherView({ status: "ready", data: { status: "unavailable", raceId: "r", reason: "no_route" } }).kind).toBe("hidden");
    expect(selectCourseWeatherView({ status: "ready", data: { status: "unavailable", raceId: "r", reason: "provider_error" } }).kind).toBe("error");
  });
});

describe("local time formatting", () => {
  it("formats an instant in the race time zone", () => {
    expect(formatLocalTime("2026-11-29T06:30:00Z", "Europe/Paris", "fr")).toBe("07:30");
    expect(formatLocalTime("2026-11-29T06:30:00Z", "America/New_York", "fr")).toBe("01:30");
    expect(formatLocalTime("nope", "Europe/Paris", "fr")).toBe("");
  });

  it("formats a calendar day without shifting it", () => {
    expect(formatLocalDay("2026-11-29", "fr")).toBe("dimanche 29 novembre");
  });

  it("builds the estimated start note", () => {
    expect(startEstimateNote(forecast, "fr")).toBe("Heure de départ estimée à 7h");
    expect(startEstimateNote({ ...forecast, startTimeIsEstimated: false }, "fr")).toBeNull();
  });
});

describe("passage rows", () => {
  const segments = [
    { from: "Départ", checkpoint: "Refuge du Col", distanceKm: 12, etaMinutes: 120 },
    { from: "Refuge du Col", checkpoint: "Arrivée", distanceKm: 24, etaMinutes: 240 },
  ];

  it("derives Départ and section-end passages from the plan", () => {
    expect(passagesFromPlanSegments(segments)).toEqual([
      { label: "Départ", distanceKm: 0, elapsedMinutes: 0 },
      { label: "Refuge du Col", distanceKm: 12, elapsedMinutes: 120 },
      { label: "Arrivée", distanceKm: 24, elapsedMinutes: 240 },
    ]);
    expect(passagesFromPlanSegments([])).toEqual([]);
  });

  it("looks up the forecast hour at each plan ETA with plan labels and local times", () => {
    const rows = buildPassageRows(forecast, passagesFromPlanSegments(segments), "fr");
    expect(rows.map((row) => row.label)).toEqual(["Départ", "Refuge du Col", "Arrivée"]);
    expect(rows.map((row) => row.timeLabel)).toEqual(["07:00", "09:00", "11:00"]);
    expect(rows[0].temperatureC).toBe(2);
    expect(rows[1].glyph).toBe("snow");
    expect(rows[1].alerts).toEqual(expect.arrayContaining(["cold", "wind", "snow"]));
    expect(rows[1].feelsLikeC).not.toBeNull();
    expect(rows[2].glyph).toBe("rain");
  });

  it("returns no rows without a start instant", () => {
    expect(buildPassageRows({ ...forecast, startAt: null }, passagesFromPlanSegments(segments), "fr")).toEqual([]);
  });
});

describe("race-day rows", () => {
  it("summarises the whole race window per point with ranges and alerts", () => {
    const rows = buildRaceDayRows(forecast, "fr");
    expect(rows.map((row) => row.label)).toEqual(["Départ", "Refuge du Col", "Arrivée"]);
    expect(rows[0].temperatureC).toBe(2);
    expect(rows[0].maxTemperatureC).toBe(4);
    expect(rows[1].glyph).toBe("snow");
    expect(rows[1].gustKph).toBe(70);
    expect(rows[1].precipitationMm).toBe(1.5);
    expect(rows[1].alerts).toEqual(expect.arrayContaining(["cold", "wind", "snow"]));
    expect(rows.every((row) => row.timeLabel === null)).toBe(true);
  });
});

describe("null gusts and probabilities (France)", () => {
  const nullish: CourseWeatherForecast = {
    ...forecast,
    points: forecast.points.map((point) => ({
      ...point,
      hours: point.hours.map((h) => ({ ...h, windGustKph: null, precipitationProbability: null })),
    })),
  };

  it("keeps wind speed and drops gusts and probability", () => {
    const rows = buildRaceDayRows(nullish, "fr");
    expect(rows[1].windKph).toBe(30);
    expect(rows[1].gustKph).toBeNull();
    expect(rows[1].precipitationProbability).toBeNull();
    const passages = buildPassageRows(nullish, passagesFromPlanSegments([{ from: "Départ", checkpoint: "Arrivée", distanceKm: 24, etaMinutes: 240 }]), "fr");
    expect(passages[0].gustKph).toBeNull();
    expect(passages[0].windKph).toBe(12);
  });
});
