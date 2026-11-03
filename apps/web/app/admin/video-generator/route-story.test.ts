import { describe, expect, it } from "vitest";

import type { VideoAidStation, VideoRoutePoint } from "../../../lib/video-generator";
import { prepareAnimationPath } from "./route-animation";
import { buildStoryBeats, detectRouteSlopes, estimateNarrationMs, getAutoDurationSeconds } from "./route-story";

// 0-10 km flat, 10-16 km climb of 600 m, 16-22 km descent of 600 m, 22-30 km flat.
const profilePoints: VideoRoutePoint[] = Array.from({ length: 301 }, (_, index) => {
  const distanceKm = index / 10;
  const elevationM = distanceKm <= 10 ? 300
    : distanceKm <= 16 ? 300 + (distanceKm - 10) * 100
      : distanceKm <= 22 ? 900 - (distanceKm - 16) * 100
        : 300;
  return { lat: 45 + distanceKm / 111, lon: 6, elevationM, distanceKm };
});

const station = (id: string, distanceKm: number, overrides: Partial<VideoAidStation> = {}): VideoAidStation => ({
  id: `00000000-0000-4000-8000-${id.padStart(12, "0")}`,
  name: `Ravito ${id}`,
  distanceKm,
  waterAvailable: true,
  foodAvailable: true,
  assistanceAllowed: false,
  isLifeBase: false,
  dropBagAvailable: false,
  cutoffTime: null,
  ...overrides,
});

const race = { title: "Trail des Crêtes", distanceKm: 30, elevationGainM: 600, startDetail: "Annecy · 7:00" };

describe("detectRouteSlopes", () => {
  it("finds the climb and the descent with their elevation and grade", () => {
    const slopes = detectRouteSlopes(prepareAnimationPath(profilePoints));
    const climb = slopes.find((slope) => slope.kind === "climb");
    const descent = slopes.find((slope) => slope.kind === "descent");
    expect(climb?.startKm).toBeCloseTo(10, 0);
    expect(climb?.endKm).toBeCloseTo(16, 0);
    expect(climb?.elevationM).toBeGreaterThan(500);
    expect(climb?.averageGrade).toBeGreaterThan(0.08);
    expect(descent?.startKm).toBeCloseTo(16, 0);
  });
});

describe("buildStoryBeats", () => {
  const path = prepareAnimationPath(profilePoints);

  it("orders intro, start, climb, aid, descent, finish and outro without overlapping spans", () => {
    const beats = buildStoryBeats(path, [station("1", 13), station("2", 25)], race, { targetSeconds: 45, includeAidStations: true, includeStart: true });
    expect(beats[0].kind).toBe("intro");
    expect(beats[beats.length - 1].kind).toBe("outro");
    const kinds = beats.map((beat) => beat.kind);
    expect(kinds).toContain("climb");
    expect(kinds).toContain("descent");
    expect(kinds).toContain("finish");
    const routeBeats = beats.slice(1, -1);
    routeBeats.forEach((beat, index) => {
      if (index > 0) expect(beat.startKm).toBeGreaterThanOrEqual(routeBeats[index - 1].endKm);
      expect(beat.narration.length).toBeGreaterThan(10);
    });
    const climb = beats.find((beat) => beat.kind === "climb");
    expect(climb?.narration).toMatch(/pour cent/);
    expect(climb?.narration).not.toMatch(/%/);
  });

  it("narrates the long rolling stretch before the climb", () => {
    const beats = buildStoryBeats(path, [], race, { targetSeconds: 45, includeAidStations: false, includeStart: false });
    const flat = beats.find((beat) => beat.kind === "flat");
    expect(flat).toBeDefined();
    expect(flat!.startKm).toBeLessThan(10);
    expect(flat!.narration).toMatch(/roulante/);
  });

  it("always narrates every station, even beyond the budget, but merges stations on top of each other", () => {
    const stations = [station("1", 5), station("2", 13, { isLifeBase: true }), station("3", 24), station("4", 24.1)];
    const beats = buildStoryBeats(path, stations, race, { targetSeconds: 15, includeAidStations: true, includeStart: false });
    const ids = beats.map((beat) => beat.id);
    expect(ids).toEqual(expect.arrayContaining([stations[0].id, stations[1].id, stations[2].id]));
    expect(ids).not.toContain(stations[3].id);
    expect(beats.some((beat) => beat.kind === "climb")).toBe(true);
    const withoutAid = buildStoryBeats(path, stations, race, { targetSeconds: 45, includeAidStations: false, includeStart: false });
    expect(withoutAid.some((beat) => beat.kind === "aid" || beat.kind === "lifeBase")).toBe(false);
  });
});

describe("durations", () => {
  it("lengthens the automatic duration with the route", () => {
    expect([10, 40, 100, 170].map(getAutoDurationSeconds)).toEqual([30, 45, 60, 90]);
  });

  it("estimates speech at about 15 characters per second", () => {
    expect(estimateNarrationMs("")).toBe(0);
    expect(estimateNarrationMs("x".repeat(150))).toBeCloseTo(10_300, -2);
  });
});
