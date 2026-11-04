import { describe, expect, it } from "vitest";

import type { VideoAidStation, VideoRoutePoint } from "../../../lib/video-generator";
import { prepareAnimationPath } from "./route-animation";
import { buildStoryBeats, detectRouteSlopes, estimateNarrationMs, getAutoDurationSeconds, getSlopeId, stripVoiceTags } from "./route-story";

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
  const options = { maxSeconds: 120, includeAidStations: true, includeStart: true };

  it("tells the route as consecutive legs from start to finish", () => {
    const beats = buildStoryBeats(path, [station("1", 13), station("2", 25)], race, options);
    expect(beats[0].kind).toBe("intro");
    expect(beats[beats.length - 1].kind).toBe("outro");
    const legs = beats.slice(1, -1);
    expect(legs[0].startKm).toBe(0);
    expect(legs[legs.length - 1].endKm).toBeCloseTo(30, 6);
    legs.forEach((leg, index) => {
      if (index > 0) expect(leg.startKm).toBeCloseTo(legs[index - 1].endKm, 6);
      expect(leg.narration).not.toMatch(/%|km\b/);
    });
    const kinds = legs.map((leg) => leg.kind);
    expect(kinds[0]).toBe("start");
    expect(kinds).toContain("climb");
    expect(kinds).toContain("descent");
  });

  it("announces what comes next on an easy leg and advises a comfortable pace", () => {
    const beats = buildStoryBeats(path, [], race, { ...options, includeStart: true });
    const first = beats[1];
    expect(first.narration).toMatch(/^On part de Annecy\./);
    expect(first.narration).toMatch(/jusqu’au pied de la première grosse montée|jusqu’au pied de la prochaine montée/);
    expect(first.narration).toMatch(/rythme confortable/);
  });

  it("names the climb after the summit found on the map", () => {
    const climb = detectRouteSlopes(path).find((slope) => slope.kind === "climb")!;
    const beats = buildStoryBeats(path, [], race, { ...options, landmarks: { [getSlopeId(climb)]: "Mont Thou" } });
    const climbLeg = beats.find((beat) => beat.kind === "climb");
    expect(climbLeg?.narration).toMatch(/montée vers Mont Thou/);
    expect(climbLeg?.facts).toContain("▲ Mont Thou");
    expect(beats[1].narration).toMatch(/jusqu’au pied de la montée vers Mont Thou/);
  });

  it("cuts at stations while the budget allows and mentions the others in passing", () => {
    const stations = [station("1", 5), station("2", 13, { isLifeBase: true }), station("3", 24), station("4", 27)];
    const generous = buildStoryBeats(path, stations, race, options);
    // The life base sits mid-climb: its leg stays a climb, titled and told from the base de vie.
    const lifeBaseLeg = generous.find((beat) => beat.title === "Ravito 2");
    expect(lifeBaseLeg?.startKm).toBeCloseTo(13, 0);
    expect(lifeBaseLeg?.narration).toMatch(/^Base de vie à Ravito 2/);

    // A 30 s reel only has room for a few legs: stations become mentions inside them.
    const short = buildStoryBeats(path, stations, race, { ...options, maxSeconds: 30 });
    expect(short.length - 2).toBeLessThanOrEqual(4);
    const told = short.map((beat) => beat.narration).join(" ");
    stations.forEach((item) => expect(told).toContain(item.name));
  });
});

describe("durations", () => {
  it("lengthens the automatic duration with the route", () => {
    expect([10, 35, 100, 180, 250].map(getAutoDurationSeconds)).toEqual([35, 50, 80, 120, 120]);
  });

  it("estimates speech at about 15 characters per second", () => {
    expect(estimateNarrationMs("")).toBe(0);
    expect(estimateNarrationMs("x".repeat(150))).toBeCloseTo(10_300, -2);
  });
});

describe("stripVoiceTags", () => {
  it("hides v3 performance tags and maps shown characters back to the spoken text", () => {
    const raw = "[excited] Allez, c’est parti ! [laughs] Garde des cuisses.";
    const { text, rawIndex } = stripVoiceTags(raw);
    expect(text).toBe("Allez, c’est parti ! Garde des cuisses.");
    expect(raw[rawIndex[0]]).toBe("A");
    expect(raw[rawIndex[text.indexOf("Garde")]]).toBe("G");
    expect(estimateNarrationMs(raw)).toBe(estimateNarrationMs(text));
  });
});
