import { describe, expect, it } from "vitest";

import type { VideoAidStation, VideoRoutePoint } from "../../../lib/video-generator";
import { getRoutePointAtDistance, prepareAnimationPath } from "./route-animation";
import { buildStoryBeats, type StoryBeat } from "./route-story";
import {
  buildElevationProfile,
  buildVideoTimeline,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  getDistanceAtFlyoverFraction,
  getFlyoverFractionAtDistance,
  getGradeAtDistance,
  getProfileTicks,
  getProfileWindow,
  getSlopeClass,
  getCameraSpeedMps,
  getOrbitLookDirection,
  getSmoothedCameraTarget,
  shiftIntoVisibleZone,
  getTimeSmoothedHeading,
  getRawVideoCameraPose,
  getVideoCameraPose,
  getVideoFrameState,
  NARRATION_LEAD_MS,
  videoCompositionSettingsSchema,
} from "./video-composition";

const flatThenClimb: VideoRoutePoint[] = [
  { lat: 45, lon: 4, elevationM: 200, distanceKm: 0 },
  { lat: 45.1, lon: 4, elevationM: 200, distanceKm: 10 },
  { lat: 45.2, lon: 4, elevationM: 2_200, distanceKm: 20 },
];

const station = (id: string, distanceKm: number, overrides: Partial<VideoAidStation> = {}): VideoAidStation => ({
  id: `00000000-0000-4000-8000-${id.padStart(12, "0")}`,
  name: `Ravito ${id}`,
  distanceKm,
  waterAvailable: true,
  foodAvailable: false,
  assistanceAllowed: false,
  isLifeBase: false,
  dropBagAvailable: false,
  cutoffTime: null,
  ...overrides,
});

const flatPath = (km: number) => prepareAnimationPath([
  { lat: 45, lon: 4, elevationM: 200, distanceKm: 0 },
  { lat: 45 + km / 111, lon: 4, elevationM: 200, distanceKm: km },
]);

describe("videoCompositionSettingsSchema", () => {
  it("provides publishable defaults and round-trips through JSON", () => {
    expect(DEFAULT_VIDEO_COMPOSITION_SETTINGS).toMatchObject({
      durationSeconds: 45,
      resolution: "540p",
      viewport: "portrait",
      introEnabled: true,
      outroEnabled: true,
      mapStyle: "paceyourself",
      routeColor: "#2d5016",
      routeCasing: true,
      highlightColor: "#d9925b",
      showAidBubbles: true,
      accentColor: "#2d5016",
      routeWidth: "normal",
      routeGlow: false,
      showPeaks: true,
    });
    const restored = videoCompositionSettingsSchema.parse(JSON.parse(JSON.stringify(DEFAULT_VIDEO_COMPOSITION_SETTINGS)));
    expect(restored).toEqual(DEFAULT_VIDEO_COMPOSITION_SETTINGS);
    expect(videoCompositionSettingsSchema.safeParse({ durationSeconds: 37 }).success).toBe(true);
    expect(videoCompositionSettingsSchema.safeParse({ durationSeconds: 10 }).success).toBe(false);
  });
});

const beat = (id: string, kind: StoryBeat["kind"], startKm: number, endKm: number, narration: string): StoryBeat => ({
  id, kind, title: id, startKm, endKm, anchorKm: startKm, facts: [], services: [], cutoffTime: null, narration,
});

const manual = (durationSeconds: number) => ({ ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, durationMode: "manual" as const, durationSeconds });

describe("buildVideoTimeline", () => {
  const path = prepareAnimationPath(flatThenClimb);

  it("sizes intro and outro to their narration and keeps a manual total", () => {
    const timeline = buildVideoTimeline(path, [beat("intro", "intro", 0, 0, "Court."), beat("outro", "outro", 20, 20, "")], manual(45));
    expect(timeline.introMs).toBe(3_000);
    expect(timeline.outroMs).toBe(3_000);
    expect(timeline.totalMs).toBe(45_000);
    const noSequences = buildVideoTimeline(path, [], { ...manual(45), introEnabled: false, outroEnabled: false });
    expect(noSequences.flyoverMs).toBe(45_000);

    const longIntro = buildVideoTimeline(path, [beat("intro", "intro", 0, 0, "x".repeat(120))], manual(45));
    expect(longIntro.introMs).toBeGreaterThan(8_000);
  });

  it("spends more time on the climb than on the flat half", () => {
    const timeline = buildVideoTimeline(path, [], manual(45));
    expect(getFlyoverFractionAtDistance(timeline, 10)).toBeLessThan(0.4);
    expect(getDistanceAtFlyoverFraction(timeline, 0)).toBe(0);
    expect(getDistanceAtFlyoverFraction(timeline, 1)).toBeCloseTo(20, 6);
  });

  it("gives a narrated span the time its voice needs and schedules the voice there", () => {
    const flat = flatPath(40);
    const narration = "Ravitaillement de Saint-Genou au kilomètre vingt : eau et nourriture.";
    const timeline = buildVideoTimeline(flat, [beat("aid", "aid", 19, 20.3, narration)], { ...manual(45), introEnabled: false, outroEnabled: false });
    const scheduled = timeline.beats[0];
    const spanMs = (getFlyoverFractionAtDistance(timeline, 20.3) - getFlyoverFractionAtDistance(timeline, 19)) * timeline.flyoverMs;
    // 1.3 km out of 40 km gets far more than its 3 % share of the time.
    expect(spanMs / timeline.flyoverMs).toBeGreaterThan(0.08);
    // The voice starts just before the camera reaches the point it talks about.
    expect(scheduled.narrationStartMs).toBeCloseTo(getFlyoverFractionAtDistance(timeline, 19) * timeline.flyoverMs - NARRATION_LEAD_MS, 0);
    expect(getVideoFrameState(timeline, scheduled.narrationStartMs + 100).beat?.id).toBe("aid");
    expect(getVideoFrameState(timeline, scheduled.endMs + 50).beat).toBeNull();
  });

  it("uses the real voice duration once generated", () => {
    const flat = flatPath(40);
    const beats = [beat("climb", "climb", 10, 14, "Texte.")];
    const estimated = buildVideoTimeline(flat, beats, manual(45));
    const voiced = buildVideoTimeline(flat, beats, manual(45), { climb: 6_000 });
    expect(voiced.beats[0].narrationMs).toBe(6_000);
    const share = (timeline: typeof voiced) => getFlyoverFractionAtDistance(timeline, 14) - getFlyoverFractionAtDistance(timeline, 10);
    expect(share(voiced)).toBeGreaterThan(share(estimated));
  });

  it("holds the camera at a life base and pulls it back when the flyover speeds up", () => {
    const flat = flatPath(40);
    const legs = (pauseMs: number) => [
      beat("a", "start", 0, 20, "Départ."),
      { ...beat("b", "lifeBase", 20, 40, "Base de vie."), pauseMs },
    ];
    const settings = { ...manual(60), introEnabled: false, outroEnabled: false };
    const noPause = buildVideoTimeline(flat, legs(0), settings);
    const paused = buildVideoTimeline(flat, legs(2_200), settings);
    const timeAroundBase = (timeline: typeof paused) =>
      (getFlyoverFractionAtDistance(timeline, 20.6) - getFlyoverFractionAtDistance(timeline, 19.9)) * timeline.flyoverMs;
    expect(timeAroundBase(paused)).toBeGreaterThan(timeAroundBase(noPause) + 1_000);

    // Helicopter framing: the distance barely changes, but still opens up a little mid-leg.
    const atBase = paused.beats[1].narrationStartMs + 600;
    const midLeg = (getFlyoverFractionAtDistance(paused, 32) * paused.flyoverMs);
    const ratio = getCameraSpeedMps(paused, midLeg) / getCameraSpeedMps(paused, atBase);
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(1.4);
    const near = getVideoCameraPose(flat, paused, getVideoFrameState(paused, atBase), "portrait");
    const far = getVideoCameraPose(flat, paused, getVideoFrameState(paused, midLeg), "portrait");
    expect(far.camera.altitudeM - far.target.altitudeM).toBeGreaterThanOrEqual(near.camera.altitudeM - near.target.altitudeM);
  });

  it("frames the whole climb while it is told, then returns to the chase", () => {
    const path = prepareAnimationPath(flatThenClimb);
    const climb = { ...beat("climb", "climb", 10, 20, "La montée vers le sommet : dix kilomètres, deux mille mètres à gravir."), focusStartKm: 10, focusEndKm: 20 };
    const timeline = buildVideoTimeline(path, [beat("start", "start", 0, 10, "Départ."), climb], { ...manual(45), introEnabled: false, outroEnabled: false });
    const told = timeline.beats.find((item) => item.id === "climb")!;
    const msAt = (distanceKm: number) => timeline.introMs + getFlyoverFractionAtDistance(timeline, distanceKm) * timeline.flyoverMs;
    // Early in the climb (while the 3.5 s rise is under way), the shot frames the whole slope.
    const during = getVideoFrameState(timeline, Math.max(told.narrationStartMs + 1_600, msAt(12.5)));
    expect(during.distanceKm).toBeLessThan(13.5);
    const framed = getRawVideoCameraPose(path, timeline, during, "portrait");
    const chase = getRawVideoCameraPose(path, timeline, { ...during, beat: null }, "portrait");
    expect(framed.target.lat).toBeGreaterThan(chase.target.lat);
    expect(framed.camera.altitudeM).toBeGreaterThan(chase.camera.altitudeM);
    // Near the top the camera is fully back on the runner, while the voice still speaks.
    const nearTop = getVideoFrameState(timeline, msAt(18.5));
    expect(nearTop.beat?.id).toBe("climb");
    expect(getRawVideoCameraPose(path, timeline, nearTop, "portrait")).toEqual(getRawVideoCameraPose(path, timeline, { ...nearTop, beat: null }, "portrait"));

    // The flight itself glides into that shot: no frame-to-frame jolt when the climb starts.
    const altitudes: number[] = [];
    const rawAltitudes: number[] = [];
    for (let ms = told.narrationStartMs - 3_000; ms < told.narrationStartMs + 6_000; ms += 1_000 / 30) {
      const frame = getVideoFrameState(timeline, ms);
      altitudes.push(getVideoCameraPose(path, timeline, frame, "portrait").camera.altitudeM);
      rawAltitudes.push(getRawVideoCameraPose(path, timeline, frame, "portrait").camera.altitudeM);
    }
    const maxJolt = (values: number[]) => Math.max(...values.slice(2).map((value, index) => Math.abs(value - 2 * values[index + 1] + values[index])));
    expect(maxJolt(altitudes)).toBeLessThan(maxJolt(rawAltitudes) * 0.5);
  });

  it("burns the narration in as short subtitle lines timed with the voice", () => {
    const timeline = buildVideoTimeline(flatPath(20), [
      beat("intro", "intro", 0, 0, "Bienvenue."),
      beat("leg", "start", 0, 20, "Départ du Musée de Bibracte. Sept kilomètres sans difficulté jusqu’au ravito de la Grande Verrière : avance à un rythme confortable."),
    ], manual(45));
    const leg = timeline.beats.find((item) => item.id === "leg")!;
    expect(leg.subtitles.length).toBeGreaterThan(2);
    // Regression: every letter survives the split (an unescaped /s+/ once removed every "s").
    expect(leg.subtitles.map((line) => line.text).join(" ")).toBe(leg.narration);
    leg.subtitles.forEach((line) => expect(line.text.length).toBeLessThanOrEqual(60));
    expect(leg.subtitles[0].startMs).toBe(leg.narrationStartMs);
    expect(leg.subtitles[leg.subtitles.length - 1].endMs).toBeCloseTo(leg.narrationStartMs + leg.narrationMs, 6);
    expect(getVideoFrameState(timeline, leg.subtitles[1].startMs + 1).subtitle).toBe(leg.subtitles[1].text);
    expect(getVideoFrameState(timeline, 600).subtitle).toBe("Bienvenue.");
  });

  it("times subtitle lines exactly from the voice character timing", () => {
    const text = "Départ. Ça grimpe.";
    // The second sentence is spoken slowly: 2 s for its 10 characters.
    const timing = Array.from(text, (_, index) => (index < 8 ? (index + 1) * 50 : 400 + (index - 7) * 200));
    const timeline = buildVideoTimeline(flatPath(10), [beat("leg", "start", 0, 10, text)], { ...manual(30), introEnabled: false, outroEnabled: false }, { leg: 2_400 }, null, { leg: timing });
    const [first, second] = timeline.beats[0].subtitles;
    expect(first.text).toBe("Départ.");
    expect(second.text).toBe("Ça grimpe.");
    expect(first.endMs - first.startMs).toBe(350);
    expect(second.endMs - timeline.beats[0].narrationStartMs).toBe(timing[timing.length - 1]);
  });

  it("turns the camera smoothly through a right-angle bend", () => {
    // 10 km north, then a sharp turn east for 10 km.
    const bend = prepareAnimationPath([
      { lat: 45, lon: 4, elevationM: 200, distanceKm: 0 },
      { lat: 45 + 10 / 111.32, lon: 4, elevationM: 200, distanceKm: 10 },
      { lat: 45 + 10 / 111.32, lon: 4 + 10 / (111.32 * Math.cos((45.09 * Math.PI) / 180)), elevationM: 200, distanceKm: 20 },
    ]);
    const timeline = buildVideoTimeline(bend, [], { ...manual(30), introEnabled: false, outroEnabled: false });
    const angleAt = (ms: number) => {
      const heading = getTimeSmoothedHeading(bend, timeline, ms)!;
      return (Math.atan2(heading.east, heading.north) * 180) / Math.PI;
    };
    let maxStep = 0;
    for (let ms = 0; ms < timeline.totalMs; ms += 1_000 / 30) maxStep = Math.max(maxStep, Math.abs(angleAt(ms + 1_000 / 30) - angleAt(ms)));
    // A 90 degree turn spread over seconds: never more than a few degrees between two frames.
    expect(maxStep).toBeLessThan(3);
    expect(angleAt(0)).toBeCloseTo(0, 0);
    expect(angleAt(timeline.totalMs)).toBeCloseTo(90, 0);
  });

  it("orbits the relief in three-quarter view and glides between legs without following the trail", () => {
    const bend = prepareAnimationPath([
      { lat: 45, lon: 4, elevationM: 200, distanceKm: 0 },
      { lat: 45 + 10 / 111.32, lon: 4, elevationM: 200, distanceKm: 10 },
      { lat: 45 + 10 / 111.32, lon: 4 + 10 / (111.32 * Math.cos((45.09 * Math.PI) / 180)), elevationM: 200, distanceKm: 20 },
    ]);
    const legs = [beat("north", "start", 0, 10, "Tout droit vers le nord."), beat("east", "flat", 10, 20, "Puis plein est jusqu’à l’arrivée.")];
    const timeline = buildVideoTimeline(bend, legs, { ...manual(30), introEnabled: false, outroEnabled: false });
    const bearingAt = (ms: number) => {
      const look = getOrbitLookDirection(bend, timeline, ms)!;
      return (Math.atan2(look.east, look.north) * 180) / Math.PI;
    };
    // Three-quarter view on the first leg: 35 degrees off its direction, not straight behind.
    expect(Math.abs(bearingAt(0))).toBeCloseTo(35, 0);
    let maxStep = 0;
    for (let ms = 0; ms < timeline.totalMs; ms += 1_000 / 30) maxStep = Math.max(maxStep, Math.abs(bearingAt(ms + 1_000 / 30) - bearingAt(ms)));
    expect(maxStep).toBeLessThan(1.5);
  });

  it("centres the camera on a smoothed position so switchbacks do not shake the picture", () => {
    // A zigzag climb: 40 switchbacks 200 m wide while heading north.
    const zigzag = prepareAnimationPath(Array.from({ length: 81 }, (_, index) => ({
      lat: 45 + (index * 0.125) / 111.32,
      lon: 4 + (index % 2 === 0 ? 0 : 0.2 / (111.32 * Math.cos((45 * Math.PI) / 180))),
      elevationM: 500 + index * 10,
      distanceKm: index * 0.24,
    })));
    const timeline = buildVideoTimeline(zigzag, [], { ...manual(30), introEnabled: false, outroEnabled: false });
    const eastOffsetM = (lon: number) => (lon - 4) * 111_320 * Math.cos((45 * Math.PI) / 180);
    const runner: number[] = [];
    const centre: number[] = [];
    for (let ms = 6_000; ms < 24_000; ms += 1_000 / 30) {
      const frame = getVideoFrameState(timeline, ms);
      runner.push(eastOffsetM(getVideoCameraPose(zigzag, timeline, { ...frame }, "portrait").target.lon));
      centre.push(eastOffsetM(getSmoothedCameraTarget(zigzag, timeline, ms).lon));
    }
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
    // The start is centred: the window shrinks to nothing at the first frame.
    const start = getSmoothedCameraTarget(zigzag, timeline, 0);
    expect(start.lat).toBeCloseTo(45, 6);
    expect(start.lon).toBeCloseTo(4, 6);
    // The leash keeps the aimed point within the given distance of the runner.
    const leashed = getSmoothedCameraTarget(zigzag, timeline, 15_000, 10);
    const runnerAt = getRoutePointAtDistance(zigzag, getVideoFrameState(timeline, 15_000).distanceKm);
    expect(Math.hypot(
      (leashed.lon - runnerAt.lon) * 111_320 * Math.cos((45 * Math.PI) / 180),
      (leashed.lat - runnerAt.lat) * 111_320,
    )).toBeLessThanOrEqual(10.01);
    // The aimed point barely moves sideways while the runner zigzags 200 m.
    expect(spread(centre)).toBeLessThan(40);
    expect(spread(runner)).toBeLessThan(40);
  });

  it("moves the whole camera rig forward so the action sits below the title band", () => {
    const pose = { camera: { lat: 45, lon: 4, altitudeM: 5_000 }, target: { lat: 45 + 4_000 / 111_320, lon: 4, altitudeM: 500 } };
    const shifted = shiftIntoVisibleZone(pose, 0.25);
    // 1 km forward (25 % of the 4 km ground distance), same altitudes, same look direction.
    expect((shifted.camera.lat - pose.camera.lat) * 111_320).toBeCloseTo(1_000, 0);
    expect((shifted.target.lat - pose.target.lat) * 111_320).toBeCloseTo(1_000, 0);
    expect(shifted.camera.altitudeM).toBe(5_000);
    expect(shifted.target.lon).toBe(4);
  });

  it("never overlaps two narrations", () => {
    const flat = flatPath(30);
    const long = "Une phrase volontairement longue pour occuper la voix plus longtemps que le segment.";
    const timeline = buildVideoTimeline(flat, [beat("a", "aid", 10, 10.2, long), beat("b", "aid", 10.2, 10.4, long)], manual(30));
    const [first, second] = timeline.beats.filter((scheduled) => scheduled.kind === "aid");
    expect(second.narrationStartMs).toBeGreaterThanOrEqual(first.narrationStartMs + first.narrationMs);
  });

  it("grows an automatic duration with the route and the narration, and flags a manual overflow", () => {
    const flat = flatPath(150);
    const story = buildStoryBeats(flat, [station("1", 50), station("2", 100, { isLifeBase: true })], { title: "Ultra", distanceKm: 150, elevationGainM: 6000, startDetail: null }, {
      maxSeconds: 120, includeAidStations: true, includeStart: false,
    });
    const auto = buildVideoTimeline(flat, story, DEFAULT_VIDEO_COMPOSITION_SETTINGS);
    // A continuous story lasts exactly as long as it is told, capped at two minutes.
    const told = auto.beats.reduce((sum, item) => sum + item.narrationMs, 0);
    expect(auto.totalMs).toBeGreaterThanOrEqual(told);
    expect(auto.totalMs).toBeLessThanOrEqual(120_000);
    // Every leg is narrated over its whole length: no silent stretch longer than the gaps.
    const legs = auto.beats.filter((item) => item.kind !== "intro" && item.kind !== "outro");
    legs.forEach((leg, index) => {
      const next = legs[index + 1];
      if (next) expect(next.narrationStartMs - (leg.narrationStartMs + leg.narrationMs)).toBeLessThan(2_000);
    });
    expect(auto.narrationOverflow).toBe(false);
    const short = buildVideoTimeline(flat, story.map((item) => ({ ...item, narration: item.narration.repeat(4) })), manual(15));
    expect(short.narrationOverflow).toBe(true);
  });
});

describe("getVideoFrameState", () => {
  const path = prepareAnimationPath(flatThenClimb);
  const timeline = buildVideoTimeline(path, [], manual(45));

  it("maps every moment to one deterministic phase and position", () => {
    expect(getVideoFrameState(timeline, 1_000)).toMatchObject({ phase: "intro", distanceKm: 0 });
    expect(getVideoFrameState(timeline, 44_000)).toMatchObject({ phase: "outro", distanceKm: 20, routeProgress: 1 });
    const middle = getVideoFrameState(timeline, 20_000);
    expect(middle.phase).toBe("flyover");
    expect(getVideoFrameState(timeline, 20_000)).toEqual(middle);
  });

  it("glides the camera from the overview to the start during the intro", () => {
    const start = getVideoCameraPose(path, timeline, getVideoFrameState(timeline, 0), "portrait");
    const glided = getVideoCameraPose(path, timeline, getVideoFrameState(timeline, 2_999), "portrait");
    const flyoverStart = getVideoCameraPose(path, timeline, getVideoFrameState(timeline, 3_000), "portrait");
    expect(start.camera.altitudeM).toBeGreaterThan(flyoverStart.camera.altitudeM);
    expect(glided.camera.lat).toBeCloseTo(flyoverStart.camera.lat, 3);
  });
});

describe("elevation profile", () => {
  it("colours every sample by slope class once per route", () => {
    const profile = buildElevationProfile(prepareAnimationPath(flatThenClimb));
    expect(profile.minElevationM).toBe(200);
    expect(profile.maxElevationM).toBe(2_200);
    const colors = new Set(profile.segments.map((segment) => segment.color));
    expect(colors.has(getSlopeClass(0).color)).toBe(true);
    expect(colors.has(getSlopeClass(0.2).color)).toBe(true);
    expect(profile.segments[0].linePath.startsWith("M0.0,")).toBe(true);
  });

  it("scrolls a window with the cursor at 35 % and clamps it to the route", () => {
    expect(getProfileWindow(100, 50, "window")).toEqual({ startKm: 50 - 18 * 0.35, endKm: 50 + 18 * 0.65 });
    expect(getProfileWindow(100, 1, "window")).toEqual({ startKm: 0, endKm: 18 });
    expect(getProfileWindow(100, 99, "window")).toEqual({ startKm: 82, endKm: 100 });
    expect(getProfileWindow(4, 2, "window")).toEqual({ startKm: 0, endKm: 4 });
    expect(getProfileWindow(100, 50, "full")).toEqual({ startKm: 0, endKm: 100 });
    expect(getProfileTicks({ startKm: 43.7, endKm: 61.7 })).toEqual([45, 50, 55, 60]);
  });

  it("measures the local grade around a distance", () => {
    const path = prepareAnimationPath(flatThenClimb);
    expect(getGradeAtDistance(path, 5)).toBeCloseTo(0, 6);
    expect(getGradeAtDistance(path, 15)).toBeCloseTo(0.2, 6);
  });
});
