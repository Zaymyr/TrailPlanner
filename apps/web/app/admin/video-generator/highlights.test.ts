import { describe, expect, it } from "vitest";

import type { VideoAidStation, VideoRoutePoint } from "../../../lib/video-generator";
import { buildHighlightBeats, MAX_HIGHLIGHTS, MIN_HIGHLIGHTS, selectHighlights } from "./highlights";
import { buildRaceFigures, toRouteAidStations } from "./race-figures";
import { astragaleTrail, ultraDesDruides } from "./reel-race-fixtures";
import { prepareAnimationPath } from "./route-animation";
import { buildRaceClock } from "./route-clock";
import { getCumulativeGainAt } from "./route-story";
import {
  buildVideoTimeline,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  getFlyoverFractionAtDistance,
  HIGHLIGHT_MAX_SECONDS,
  HIGHLIGHT_MIN_SECONDS,
  type VideoTimeline,
} from "./video-composition";

// 0-8 flat, 8-14 climb +600 m (10 %), 14-18 descent -600 m, 18-26 flat, 26-29 climb +240 m, 29-32 descent.
const profilePoints: VideoRoutePoint[] = Array.from({ length: 321 }, (_, index) => {
  const distanceKm = index / 10;
  const elevationM = distanceKm <= 8 ? 300
    : distanceKm <= 14 ? 300 + (distanceKm - 8) * 100
      : distanceKm <= 18 ? 900 - (distanceKm - 14) * 150
        : distanceKm <= 26 ? 300
          : distanceKm <= 29 ? 300 + (distanceKm - 26) * 80
            : 540 - (distanceKm - 29) * 80;
  return { lat: 45 + distanceKm / 111, lon: 6, elevationM, distanceKm };
});

const station = (id: string, name: string, distanceKm: number, overrides: Partial<VideoAidStation> = {}): VideoAidStation => ({
  id: `00000000-0000-4000-8000-${id.padStart(12, "0")}`,
  name,
  distanceKm,
  waterAvailable: true,
  foodAvailable: true,
  assistanceAllowed: false,
  isLifeBase: false,
  dropBagAvailable: false,
  cutoffTime: null,
  ...overrides,
});

const path = prepareAnimationPath(profilePoints);
const identity = buildRaceFigures({ raceDistanceKm: 32, raceElevationGainM: null, routeDistanceKm: 32, routeElevationGainM: getCumulativeGainAt(path, 32) });
const race = { title: "Trail des Crêtes", distanceKm: 32, elevationGainM: 840, startDetail: null };

describe("selectHighlights", () => {
  it("picks the hardest climb, the refuel station before it, the last climb and the biggest descent, in course order", () => {
    const stations = [station("1", "Col du Loup", 6), station("2", "Plaine", 22)];
    const highlights = selectHighlights(path, stations, null, identity);
    expect(highlights.map((highlight) => highlight.kind)).toEqual(["strategicAid", "hardestClimb", "biggestDescent", "lastClimb"]);
    expect(highlights[0].station?.name).toBe("Col du Loup");
    expect(highlights[0].beforeHardestClimb).toBe(true);
    expect(highlights[1].startKm).toBeCloseTo(8, 0);
    expect(highlights[1].endKm).toBeCloseTo(14, 0);
    // Slope ends are trimmed on the smoothed profile: about 600 m at 10 %.
    expect(highlights[1].facts[1]).toMatch(/^\+(5[5-9]0|600) m$/);
    expect(highlights[1].facts[2]).toBe("10 %");
    // Course order, no overlap.
    highlights.slice(1).forEach((highlight, index) => expect(highlight.startKm).toBeGreaterThanOrEqual(highlights[index].endKm));
  });

  it("is deterministic and keeps stable ids", () => {
    const stations = [station("1", "Col du Loup", 6)];
    const first = selectHighlights(path, stations, null, identity);
    const second = selectHighlights(path, [...stations], null, identity);
    expect(second).toEqual(first);
    expect(first.map((highlight) => highlight.id)).toEqual([
      "hl-strategicAid-00000000-0000-4000-8000-000000000001",
      expect.stringMatching(/^hl-hardestClimb-\d+$/),
      expect.stringMatching(/^hl-biggestDescent-\d+$/),
      expect.stringMatching(/^hl-lastClimb-\d+$/),
    ]);
  });

  it("mentions a station inside a kept moment with it instead of making two overlapping moments", () => {
    const highlights = selectHighlights(path, [station("3", "Mi-côte", 11, { cutoffTime: "10:30" })], null, identity);
    expect(highlights.some((highlight) => highlight.kind === "strategicAid")).toBe(false);
    const climb = highlights.find((highlight) => highlight.kind === "hardestClimb");
    expect(climb?.nearbyStations.map((item) => item.name)).toEqual(["Mi-côte"]);
    expect(climb?.facts).toContain("Ravito Mi-côte km 11");
  });

  it("adds the night passage from the estimated clock and shows kilometres in the announced scale", () => {
    // Announced 35.2 km for a 32 km GPX: every kilometre shown is ×1.1.
    // A flat 32 km route started at 15:30 in December: night falls around km 22.
    const flat = prepareAnimationPath(profilePoints.map((point) => ({ ...point, elevationM: 300 })));
    const figures = buildRaceFigures({ raceDistanceKm: 35.2, raceElevationGainM: null, routeDistanceKm: 32, routeElevationGainM: 0 });
    const clock = buildRaceClock(flat, [], { raceDate: "2026-12-12", startTime: "15:30" });
    const highlights = selectHighlights(flat, [], clock, figures);
    const night = highlights.find((highlight) => highlight.kind === "night");
    expect(night).toBeDefined();
    expect(night?.startKm).toBeGreaterThan(18);
    expect(night?.nightStartMinutes).toBeGreaterThan(17 * 60);
    expect(night?.facts[0]).toMatch(/^km [\d,]+ → 35,2 de nuit$/);
    // Without climbs, descents or stations, the night is the only moment worth telling.
    expect(highlights.length).toBeLessThanOrEqual(MAX_HIGHLIGHTS);
    // A night inside a kept climb or descent is not a second moment.
    const hilly = selectHighlights(path, [], buildRaceClock(path, [], { raceDate: "2026-12-12", startTime: "15:30" }), figures);
    hilly.slice(1).forEach((highlight, index) => expect(highlight.startKm).toBeGreaterThanOrEqual(hilly[index].endKm));
    expect(hilly.length).toBeGreaterThanOrEqual(MIN_HIGHLIGHTS);
  });

  it("turns the moments into short beats between a short intro and outro", () => {
    const highlights = selectHighlights(path, [station("1", "Col du Loup", 6)], null, identity);
    const beats = buildHighlightBeats(highlights, path, race, { figures: identity });
    expect(beats.map((beat) => beat.kind)).toEqual(["intro", "aid", "climb", "descent", "climb", "outro"]);
    expect(beats[0].narration).toBe("Trail des Crêtes : 32 km, 840 m D+. Les temps forts !");
    expect(beats[2].narration).toMatch(/^Le gros morceau : [\d,]+ km à 10 %, \+\d+ m\. Mode diesel !$/);
    beats.forEach((beat) => expect(beat.narration.length).toBeLessThanOrEqual(90));
  });
});

const highlightsSettings = { ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, storyMode: "highlights" as const };

const buildFixtureReel = (fixture: typeof astragaleTrail) => {
  const fixturePath = prepareAnimationPath(fixture.points);
  const figures = buildRaceFigures({
    raceDistanceKm: fixture.race.distanceKm,
    raceElevationGainM: fixture.race.elevationGainM,
    routeDistanceKm: fixturePath.totalDistanceKm,
    routeElevationGainM: getCumulativeGainAt(fixturePath, fixturePath.totalDistanceKm),
  });
  const stations = toRouteAidStations(figures, fixture.aidStations);
  const clock = buildRaceClock(fixturePath, stations, fixture.race);
  const highlights = selectHighlights(fixturePath, stations, clock, figures);
  const beats = buildHighlightBeats(highlights, fixturePath, fixture.race, { figures });
  const timeline = buildVideoTimeline(fixturePath, beats, highlightsSettings, {}, clock);
  return { figures, highlights, timeline };
};

const msAt = (timeline: VideoTimeline, distanceKm: number) =>
  timeline.introMs + getFlyoverFractionAtDistance(timeline, distanceKm) * timeline.flyoverMs;

const expectHighlightsReel = ({ highlights, timeline }: ReturnType<typeof buildFixtureReel>) => {
  expect(highlights.length).toBeGreaterThanOrEqual(MIN_HIGHLIGHTS);
  expect(highlights.length).toBeLessThanOrEqual(MAX_HIGHLIGHTS);
  // 30-45 s aimed at with the default narration, 50 s hard cap, no squeezed voice.
  expect(timeline.totalMs).toBeGreaterThanOrEqual(HIGHLIGHT_MIN_SECONDS * 1_000);
  expect(timeline.totalMs).toBeLessThanOrEqual(45_000);
  expect(timeline.totalMs).toBeLessThanOrEqual(HIGHLIGHT_MAX_SECONDS * 1_000);
  expect(timeline.narrationOverflow).toBe(false);
  // The camera dwells on the moments: most of the flyover is spent inside them, and each jump
  // between two moments is a short transit.
  const dwellMs = highlights.reduce((sum, highlight) => sum + msAt(timeline, highlight.endKm) - msAt(timeline, highlight.startKm), 0);
  expect(dwellMs / timeline.flyoverMs).toBeGreaterThan(0.6);
  highlights.slice(1).forEach((highlight, index) => {
    expect(msAt(timeline, highlight.startKm) - msAt(timeline, highlights[index].endKm)).toBeLessThan(2_000);
  });
  expect(timeline.cameraTempo).toBeLessThan(1);
};

describe("highlights reel on the test races", () => {
  it("Hivernale des Templiers, Astragale Trail (67 km): three moments, about 30 s", () => {
    const reel = buildFixtureReel(astragaleTrail);
    expect(reel.figures.distanceSource).toBe("race");
    expect(reel.highlights.map((highlight) => highlight.kind)).toEqual(["hardestClimb", "lastClimb", "biggestDescent"]);
    expectHighlightsReel(reel);
  });

  it("Bibracte, L'Ultra des Druides (185 km): five moments with the night and a cutoff, about 40 s", () => {
    const reel = buildFixtureReel(ultraDesDruides);
    expect(reel.figures.distanceSource).toBe("race");
    expect(reel.highlights).toHaveLength(5);
    expect(reel.highlights.map((highlight) => highlight.kind)).toEqual(expect.arrayContaining(["night", "hardestClimb", "strategicAid"]));
    expect(reel.highlights.find((highlight) => highlight.kind === "strategicAid")?.station?.cutoffTime).toBeTruthy();
    expectHighlightsReel(reel);
  });

  it("caps the reel at 50 s when the narration runs long, and flags it", () => {
    const fixturePath = prepareAnimationPath(ultraDesDruides.points);
    const { highlights, figures } = buildFixtureReel(ultraDesDruides);
    const long = buildHighlightBeats(highlights, fixturePath, ultraDesDruides.race, { figures })
      .map((beat) => ({ ...beat, narration: "Une phrase bien trop longue pour un temps fort. ".repeat(4) }));
    const timeline = buildVideoTimeline(fixturePath, long, highlightsSettings);
    expect(timeline.totalMs).toBe(HIGHLIGHT_MAX_SECONDS * 1_000);
    expect(timeline.narrationOverflow).toBe(true);
  });
});
