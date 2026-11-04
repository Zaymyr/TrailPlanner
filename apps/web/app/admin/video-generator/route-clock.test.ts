import { describe, expect, it } from "vitest";

import type { VideoAidStation, VideoRoutePoint } from "../../../lib/video-generator";
import { prepareAnimationPath } from "./route-animation";
import {
  buildRaceClock,
  formatClockTime,
  getClassicEffortSpeed,
  getDaylightAt,
  getElapsedMinutes,
  getSunPosition,
  getTimeZoneOffsetMinutes,
  parseClockTime,
} from "./route-clock";

// Flat 80 km near Lyon.
const points: VideoRoutePoint[] = Array.from({ length: 81 }, (_, index) => ({
  lat: 45.75, lon: 4.85 + index * 0.012, elevationM: 300, distanceKm: index,
}));
const path = prepareAnimationPath(points);

const station = (distanceKm: number, overrides: Partial<VideoAidStation> = {}): VideoAidStation => ({
  id: `00000000-0000-4000-8000-${String(distanceKm).padStart(12, "0")}`,
  name: `Ravito ${distanceKm}`,
  distanceKm,
  waterAvailable: true,
  foodAvailable: true,
  assistanceAllowed: false,
  isLifeBase: false,
  dropBagAvailable: false,
  cutoffTime: null,
  ...overrides,
});

describe("clock helpers", () => {
  it("parses organizer times and formats minutes of day", () => {
    expect(parseClockTime("23:30")).toBe(1_410);
    expect(parseClockTime("7h05")).toBe(425);
    expect(parseClockTime("25:00")).toBeNull();
    expect(formatClockTime(1_410 + 200)).toBe("02:50");
  });

  it("knows the Paris offset in winter and summer", () => {
    expect(getTimeZoneOffsetMinutes(Date.UTC(2026, 0, 15, 12))).toBe(60);
    expect(getTimeZoneOffsetMinutes(Date.UTC(2026, 6, 15, 12))).toBe(120);
  });

  it("puts the sun high at a summer noon and below the horizon at night", () => {
    expect(getSunPosition(Date.UTC(2026, 5, 21, 11, 40), 45.75, 4.85).elevationDeg).toBeGreaterThan(60);
    expect(getSunPosition(Date.UTC(2026, 11, 1, 1, 0), 45.75, 4.85).elevationDeg).toBeLessThan(-30);
    const morning = getSunPosition(Date.UTC(2026, 5, 21, 6, 0), 45.75, 4.85);
    expect(morning.azimuthDeg).toBeGreaterThan(45);
    expect(morning.azimuthDeg).toBeLessThan(120);
  });

  it("slows the classic pace as the effort grows", () => {
    expect(getClassicEffortSpeed(25)).toBeGreaterThan(getClassicEffortSpeed(103));
    expect(getClassicEffortSpeed(103)).toBeCloseTo(8.44, 1);
  });
});

describe("buildRaceClock", () => {
  it("needs a start time", () => {
    expect(buildRaceClock(path, [], { raceDate: "2026-11-28", startTime: null })).toBeNull();
  });

  it("estimates a night start that reaches dawn, with stops at stations", () => {
    const clock = buildRaceClock(path, [station(40, { isLifeBase: true })], { raceDate: "2026-11-28", startTime: "23:30" })!;
    expect(getElapsedMinutes(clock, 0)).toBe(0);
    // 80 effort-km at about 8.5 km/h plus a 15 min life base stop.
    expect(getElapsedMinutes(clock, 80) / 60).toBeGreaterThan(9);
    expect(getElapsedMinutes(clock, 80) / 60).toBeLessThan(11);
    expect(getDaylightAt(clock, 1)).toMatchObject({ isNight: true });
    expect(Math.round(getDaylightAt(clock, 0).minutesOfDay)).toBe(1_410);
    expect(getDaylightAt(clock, 80).level).toBeGreaterThan(getDaylightAt(clock, 10).level);
  });

  it("pulls the estimate before a cutoff it would miss", () => {
    const free = buildRaceClock(path, [], { raceDate: "2026-06-20", startTime: "06:00" })!;
    const atFortyFree = getElapsedMinutes(free, 40);
    const clock = buildRaceClock(path, [station(40, { cutoffTime: "09:00" })], { raceDate: "2026-06-20", startTime: "06:00" })!;
    expect(atFortyFree).toBeGreaterThan(180);
    expect(getElapsedMinutes(clock, 40)).toBeCloseTo(180 * 0.85, -1);
  });
});
