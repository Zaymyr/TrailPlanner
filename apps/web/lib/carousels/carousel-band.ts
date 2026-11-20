import { getSunPosition, getTimeZoneOffsetMinutes, parseClockTime } from "../../app/admin/video-generator/route-clock";
import { formatKm } from "./carousel-format";

/**
 * The continuous band at the bottom of a carousel strip (pure): the ridge, the dotted trail, the
 * start/finish flags, the aid-station sign plates, the « KM a → b » marker of each slide and the
 * sky that follows the race clock. Rules: docs/05-integrations/instagram-carousels.md (« Band »).
 *
 * Level 1: a real profile (GPX). Level 2: aid stations without GPX: a flat path with the stations
 * at their real kilometre and generic decor mountains whose steepness follows D+/km. Level 3:
 * neither: a flat path with kilometre stones. A fake profile is never drawn.
 */

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;
export const BAND_TOP = 1120;
/** The sky fades in under the content from this height. */
export const SKY_TOP = 640;
const RIDGE_BOTTOM = 1338;
const RIDGE_AMPLITUDE = 150;
const FLAT_GROUND = 1290;
const SIGN_MIN_TOP = BAND_TOP + 78;
const SIGN_ROW_STEP = 44;
const SIGN_ROWS = 2;
/** JetBrains Mono 19 px, weight 800: width of one character of a plate. */
const SIGN_CHAR_WIDTH = 11.2;
const SIGN_PADDING = 30;
const SIGN_ARROW = 18;
const SIGN_GAP = 16;
const FLAG_CHAR_WIDTH = 13;
/** A full « KM 17 · Name » plate needs a name at most this long; otherwise every plate is short. */
export const SIGN_NAME_MAX = 18;

export type BandLevel = 1 | 2 | 3;

export type BandStation = { km: number; name: string };

export type BandInput = {
  slideCount: number;
  /** Announced race distance (the truth for every kilometre shown). */
  totalKm: number;
  elevationGainM: number | null;
  /** GPX profile in GPX kilometres; rescaled to the announced distance. */
  profile: Array<{ km: number; elevationM: number }> | null;
  stations: BandStation[];
  startLabel: string;
  finishLabel: string;
  /** Elapsed seconds per kilometre (middle objective) and the start instant, when known. */
  clock: { startUtcMs: number; lat: number; lon: number; timeline: Array<{ km: number; seconds: number }> } | null;
};

export type SkyStop = { offset: number; color: string };
export type BandSign = { x: number; groundY: number; top: number; label: string; width: number; plate: boolean };
export type BandFlag = { x: number; y: number; label: string; right: boolean; ink: string };

export type BandLayout = {
  level: BandLevel;
  width: number;
  ridgePath: string;
  groundColor: string;
  thirdsColor: string;
  decor: Array<{ path: string; color: string; opacity: number }>;
  stars: Array<{ x: number; y: number; r: number }>;
  moon: { x: number; y: number } | null;
  sun: { x: number; y: number; r: number } | null;
  signs: BandSign[];
  compactSigns: boolean;
  stones: Array<{ x: number; km: number }>;
  flags: [BandFlag, BandFlag];
  thirds: string[];
  sky: SkyStop[];
};

/** Level 1 with a usable profile, else 2 with aid stations, else 3. */
export const selectBandLevel = (input: Pick<BandInput, "profile" | "stations">): BandLevel => {
  const profile = input.profile ?? [];
  if (profile.length >= 2 && profile[profile.length - 1].km > profile[0].km) return 1;
  return input.stations.length > 0 ? 2 : 3;
};

// -- Sky ------------------------------------------------------------------------------------------

const SKY_ANCHORS: Array<[number, string]> = [
  [-90, "#0E1A06"], [-14, "#0E1A06"], [-8, "#1F3810"], [-3, "#3F6F8F"], [2, "#E8A36A"], [8, "#F6D3B5"], [18, "#CFE3EE"], [90, "#DCEBF2"],
];
export const DAY_SKY: SkyStop[] = [{ offset: 0, color: "#CFE3EE" }, { offset: 1, color: "#EAF1F5" }];

const hexToRgb = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
const rgbToHex = (rgb: number[]) => `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`;

/** Sky colour for a solar elevation (degrees): night, twilight blue, dawn orange, day blue. */
export const skyColorAt = (elevationDeg: number) => {
  const value = Math.max(-90, Math.min(90, elevationDeg));
  for (let index = 1; index < SKY_ANCHORS.length; index += 1) {
    const [high, highColor] = SKY_ANCHORS[index];
    if (value <= high) {
      const [low, lowColor] = SKY_ANCHORS[index - 1];
      const t = high > low ? (value - low) / (high - low) : 0;
      const from = hexToRgb(lowColor);
      const to = hexToRgb(highColor);
      return rgbToHex(from.map((channel, channelIndex) => channel + (to[channelIndex] - channel) * t));
    }
  }
  return SKY_ANCHORS[SKY_ANCHORS.length - 1][1];
};

/** Luminance 0-1 of a hex colour, to pick a readable ink. */
export const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const interpolateSeconds = (timeline: Array<{ km: number; seconds: number }>, km: number) => {
  if (!timeline.length) return 0;
  if (km <= timeline[0].km) return timeline[0].seconds;
  for (let index = 1; index < timeline.length; index += 1) {
    if (km <= timeline[index].km) {
      const previous = timeline[index - 1];
      const next = timeline[index];
      const span = next.km - previous.km;
      return previous.seconds + (span > 0 ? ((km - previous.km) / span) * (next.seconds - previous.seconds) : 0);
    }
  }
  return timeline[timeline.length - 1].seconds;
};

const SKY_SAMPLES = 25;

/** Solar elevation along the race (one sample per 1/24 of the distance), from the race clock. */
export const sampleSunElevations = (clock: NonNullable<BandInput["clock"]>, totalKm: number) =>
  Array.from({ length: SKY_SAMPLES }, (_, index) => {
    const km = (totalKm * index) / (SKY_SAMPLES - 1);
    const utcMs = clock.startUtcMs + interpolateSeconds(clock.timeline, km) * 1_000;
    return { offset: index / (SKY_SAMPLES - 1), elevationDeg: getSunPosition(utcMs, clock.lat, clock.lon).elevationDeg };
  });

/** Horizontal gradient stops of the sky; consecutive identical colours are merged. Day sky without a clock. */
export const buildSkyStops = (clock: BandInput["clock"], totalKm: number): SkyStop[] => {
  if (!clock || !(totalKm > 0)) return DAY_SKY;
  const stops = sampleSunElevations(clock, totalKm).map((sample) => ({ offset: Number(sample.offset.toFixed(4)), color: skyColorAt(sample.elevationDeg) }));
  return stops.filter((stop, index) => index === 0 || index === stops.length - 1 || stop.color !== stops[index - 1].color || stop.color !== stops[index + 1]?.color);
};

/** "2026-11-28" + "23:30" (Paris wall time) → UTC instant, or null without a valid time. */
export const parisStartUtcMs = (raceDate: string | null, startTime: string | null) => {
  const minutes = parseClockTime(startTime);
  const match = raceDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (minutes === null || !match) return null;
  const midnight = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const offset = getTimeZoneOffsetMinutes(midnight + 12 * 3_600_000);
  return midnight + (minutes - offset) * 60_000;
};

/** Night at the start: the sun is below the civil twilight (−6°) when the gun goes off. */
export const isNightStart = (startUtcMs: number | null, lat: number, lon: number) =>
  startUtcMs !== null && getSunPosition(startUtcMs, lat, lon).elevationDeg < -6;

// -- Geometry -------------------------------------------------------------------------------------

/** Deterministic pseudo-random sequence (decor shapes and stars never change between renders). */
const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 9_301 + 49_297) % 233_280;
    return state / 233_280;
  };
};

/** Profile rescaled to the announced distance and to the band (x in px, y in strip px). */
export const scaleProfile = (profile: Array<{ km: number; elevationM: number }>, totalKm: number, width: number, step = 6) => {
  const sorted = [...profile].sort((left, right) => left.km - right.km);
  const startKm = sorted[0].km;
  const gpxKm = sorted[sorted.length - 1].km - startKm;
  const elevations = sorted.map((point) => point.elevationM);
  const low = Math.min(...elevations);
  const high = Math.max(...elevations);
  const span = high - low;
  const elevationAt = (raceKm: number) => {
    const gpx = startKm + (gpxKm > 0 ? (raceKm / totalKm) * gpxKm : 0);
    if (gpx <= sorted[0].km) return sorted[0].elevationM;
    for (let index = 1; index < sorted.length; index += 1) {
      if (gpx <= sorted[index].km) {
        const previous = sorted[index - 1];
        const next = sorted[index];
        const t = next.km > previous.km ? (gpx - previous.km) / (next.km - previous.km) : 0;
        return previous.elevationM + (next.elevationM - previous.elevationM) * t;
      }
    }
    return sorted[sorted.length - 1].elevationM;
  };
  const yOf = (elevation: number) => (span < 1 ? FLAT_GROUND : RIDGE_BOTTOM - ((elevation - low) / span) * RIDGE_AMPLITUDE);
  const groundYAt = (raceKm: number) => Number(yOf(elevationAt(raceKm)).toFixed(1));
  const points: Array<{ x: number; y: number }> = [];
  for (let x = 0; x <= width; x += step) points.push({ x, y: groundYAt((x / width) * totalKm) });
  if (points[points.length - 1].x !== width) points.push({ x: width, y: groundYAt(totalKm) });
  return { points, groundYAt };
};

const pathOf = (points: Array<{ x: number; y: number }>) =>
  points.map((point, index) => `${index ? "L" : "M"}${Number(point.x.toFixed(1))} ${Number(point.y.toFixed(1))}`).join(" ");

/** Decor mountains: an ambiance, never a profile. Only their steepness follows D+ per km. */
export const buildDecor = (width: number, elevationGainM: number | null, totalKm: number) => {
  if (elevationGainM === null || !(totalKm > 0)) return [];
  const perKm = elevationGainM / totalKm;
  const amplitude = Math.min(90, 25 + perKm * 1.1);
  const layer = (seed: number, base: number, color: string, opacity: number) => {
    const next = seeded(seed);
    const points: string[] = [];
    for (let x = -40; x <= width + 40; x += 120) points.push(`L${x} ${Math.round(base - amplitude * (0.35 + 0.65 * next()))}`);
    return { path: `M-40 ${SLIDE_HEIGHT} ${points.join(" ")} L${width + 40} ${SLIDE_HEIGHT} Z`, color, opacity };
  };
  return [layer(7, FLAT_GROUND - 18, "#8FB06E", 0.5), layer(31, FLAT_GROUND, "#3F6B1F", 0.55)];
};

/** Kilometre stones: every 10 km, every 5 km under 30 km; none at the start nor next to the finish. */
export const buildStones = (totalKm: number, width: number) => {
  const step = totalKm < 30 ? 5 : 10;
  const stones: Array<{ x: number; km: number }> = [];
  for (let km = step; km < totalKm - step / 2; km += step) stones.push({ x: Number(((km / totalKm) * width).toFixed(1)), km });
  return stones;
};

/** « KM 0 → 27 » for each slide of the strip. */
export const buildThirds = (totalKm: number, slideCount: number) =>
  Array.from({ length: slideCount }, (_, index) => `KM ${Math.round((totalKm * index) / slideCount)} → ${Math.round((totalKm * (index + 1)) / slideCount)}`);

/** Short name of a station for a full plate: the part before « · », « - » or a parenthesis. */
export const shortStationName = (name: string) => name.split(/\s[·–-]\s|\(|,/)[0].trim();

const signWidth = (label: string) => SIGN_PADDING + label.length * SIGN_CHAR_WIDTH;

/**
 * Plates of the aid stations. Full « KM 17 · Name » plates when every name is short enough and no
 * two plates (nor a flag label) overlap; otherwise short « KM 58 » plates for all. Short plates
 * that still overlap go up one row; a plate with no free row keeps only its post.
 */
export const layoutSigns = (
  stations: BandStation[],
  totalKm: number,
  width: number,
  groundYAt: (km: number) => number,
  flagLabels: { start: string; finish: string },
): { signs: BandSign[]; compact: boolean } => {
  const sorted = [...stations].filter((station) => station.km > 0 && station.km < totalKm).sort((left, right) => left.km - right.km);
  const xOf = (km: number) => Number(((km / totalKm) * width).toFixed(1));
  const startBlock = { from: 0, to: 82 + flagLabels.start.length * FLAG_CHAR_WIDTH };
  const finishBlock = { from: width - 48 - flagLabels.finish.length * FLAG_CHAR_WIDTH, to: width };
  const spans = (labels: string[]) => sorted.map((station, index) => ({ from: xOf(station.km) - 6, to: xOf(station.km) + signWidth(labels[index]) + SIGN_ARROW }));
  const overlaps = (boxes: Array<{ from: number; to: number }>) =>
    boxes.some((box, index) => (index > 0 && box.from < boxes[index - 1].to + SIGN_GAP))
    || (boxes.length > 0 && (boxes[0].from < startBlock.to + SIGN_GAP || boxes[boxes.length - 1].to + SIGN_GAP > finishBlock.from));
  const fullLabels = sorted.map((station) => `KM ${formatKm(station.km)} · ${shortStationName(station.name)}`);
  const compact = sorted.some((station) => shortStationName(station.name).length > SIGN_NAME_MAX) || overlaps(spans(fullLabels));
  const labels = compact ? sorted.map((station) => `KM ${formatKm(station.km)}`) : fullLabels;

  // Row 0 is the default height; flags occupy both rows at the ends.
  const rows: Array<Array<{ from: number; to: number }>> = Array.from({ length: SIGN_ROWS }, () => [startBlock, finishBlock]);
  const signs = sorted.map((station, index) => {
    const x = xOf(station.km);
    const groundY = groundYAt(station.km);
    const baseTop = Math.max(groundY - 64, SIGN_MIN_TOP);
    const box = { from: x - 6, to: x + signWidth(labels[index]) + SIGN_ARROW };
    const row = rows.findIndex((taken) => taken.every((other) => box.to + SIGN_GAP <= other.from || box.from >= other.to + SIGN_GAP));
    if (row >= 0) rows[row].push(box);
    return {
      x,
      groundY,
      top: baseTop - Math.max(0, row) * SIGN_ROW_STEP,
      label: labels[index],
      width: Number(signWidth(labels[index]).toFixed(1)),
      plate: row >= 0,
    };
  });
  return { signs, compact };
};

/** Stars over the night stretches, the moon in the first one and the sun at the brightest point. */
const buildCelestial = (sky: BandInput["clock"], totalKm: number, width: number) => {
  if (!sky) return { stars: [], moon: null, sun: { x: Math.round(width * 0.9), y: 1196, r: 34 } };
  const samples = sampleSunElevations(sky, totalKm);
  const next = seeded(13);
  const stars: Array<{ x: number; y: number; r: number }> = [];
  for (let x = 120; x < width; x += 140) {
    const offset = x / width;
    const nearest = samples.reduce((best, sample) => (Math.abs(sample.offset - offset) < Math.abs(best.offset - offset) ? sample : best));
    const y = Math.round(1180 + next() * 40);
    if (nearest.elevationDeg < -8) stars.push({ x, y, r: stars.length % 3 ? 2 : 2.8 });
  }
  const nightIndex = samples.findIndex((sample) => sample.elevationDeg < -8);
  let moon: { x: number; y: number } | null = null;
  if (nightIndex >= 0) {
    let end = nightIndex;
    while (end + 1 < samples.length && samples[end + 1].elevationDeg < -8) end += 1;
    moon = { x: Math.round((((samples[nightIndex].offset + samples[end].offset) / 2) * width)), y: 1206 };
  }
  const brightest = samples.reduce((best, sample) => (sample.elevationDeg > best.elevationDeg ? sample : best));
  const sun = brightest.elevationDeg > -3
    ? { x: Math.round(Math.min(width - 160, Math.max(160, brightest.offset * width))), y: Math.round(1270 - Math.min(30, Math.max(0, brightest.elevationDeg)) * 2.4), r: 40 }
    : null;
  if (moon && sun && Math.abs(moon.x - sun.x) < 200) moon = null;
  return { stars, moon, sun };
};

const inkOn = (color: string) => (luminance(color) < 0.45 ? "#FAF8F2" : "#1F3810");

/** The whole band of a strip of `slideCount` slides. */
export const buildBand = (input: BandInput): BandLayout => {
  const width = SLIDE_WIDTH * input.slideCount;
  const level = selectBandLevel(input);
  const sky = buildSkyStops(input.clock, input.totalKm);
  const profile = level === 1 ? scaleProfile(input.profile ?? [], input.totalKm, width) : null;
  const groundYAt = profile ? profile.groundYAt : () => FLAT_GROUND;
  const ridgePath = profile ? pathOf(profile.points) : `M0 ${FLAT_GROUND} L${width} ${FLAT_GROUND}`;
  const { signs, compact } = level === 3
    ? { signs: [], compact: false }
    : layoutSigns(input.stations, input.totalKm, width, groundYAt, { start: input.startLabel, finish: input.finishLabel });
  const celestial = buildCelestial(input.clock, input.totalKm, width);
  return {
    level,
    width,
    ridgePath,
    groundColor: level === 1 ? "#1F3810" : "#3F6B1F",
    thirdsColor: level === 1 ? "#B5CC9A" : "#FAF8F2",
    decor: level === 1 ? [] : buildDecor(width, input.elevationGainM, input.totalKm),
    ...celestial,
    signs,
    compactSigns: compact,
    stones: level === 3 ? buildStones(input.totalKm, width) : [],
    flags: [
      { x: 36, y: groundYAt(0), label: input.startLabel, right: false, ink: inkOn(sky[0].color) },
      { x: width - 36, y: groundYAt(input.totalKm), label: input.finishLabel, right: true, ink: inkOn(sky[sky.length - 1].color) },
    ],
    thirds: buildThirds(input.totalKm, input.slideCount),
    sky,
  };
};
