import type { VideoAidStation } from "../../../lib/video-generator";
import { getRoutePointAtDistance, type PreparedAnimationPath } from "./route-animation";

export const AID_SERVICES = {
  water: "Eau",
  food: "Nourriture",
  assistance: "Assistance",
  dropBag: "Sac d’allègement",
} as const;
export type AidService = keyof typeof AID_SERVICES;

export const getAidStationServices = (station: VideoAidStation): AidService[] => {
  const services: AidService[] = [];
  if (station.waterAvailable) services.push("water");
  if (station.foodAvailable) services.push("food");
  if (station.assistanceAllowed) services.push("assistance");
  if (station.dropBagAvailable) services.push("dropBag");
  return services;
};

export type RouteSlope = {
  kind: "climb" | "descent";
  startKm: number;
  endKm: number;
  /** Positive elevation change: gain for a climb, loss for a descent. */
  elevationM: number;
  /** Average grade as a ratio (0.09 = 9 %), always positive. */
  averageGrade: number;
  startElevationM: number;
  endElevationM: number;
};

export type StoryBeatKind = "intro" | "start" | "climb" | "descent" | "aid" | "lifeBase" | "finish" | "outro";

/**
 * One moment of the narrated video. Route beats own a distance span the camera covers while the
 * narration plays; intro and outro beats play over the overview shots.
 */
export type StoryBeat = {
  id: string;
  kind: StoryBeatKind;
  title: string;
  startKm: number;
  endKm: number;
  anchorKm: number;
  /** Short facts shown in the caption and sent to the script writer, e.g. "6,2 km", "+540 m". */
  facts: string[];
  services: AidService[];
  cutoffTime: string | null;
  narration: string;
};

export type StoryRaceInfo = {
  title: string;
  distanceKm: number;
  elevationGainM: number | null;
  startDetail: string | null;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const formatKm = (value: number) => formatNumber(value, value < 10 ? 1 : 0);
const formatPercent = (ratio: number) => formatNumber(ratio * 100, 0);

/** Elevation every ~100 m, smoothed over ±250 m so GPS noise does not create fake climbs. */
const sampleElevation = (path: PreparedAnimationPath) => {
  const total = path.totalDistanceKm;
  const stepKm = Math.max(0.1, total / 2_000);
  const count = Math.max(2, Math.floor(total / stepKm) + 1);
  const distances = Array.from({ length: count }, (_, index) => Math.min(total, index * stepKm));
  const raw = distances.map((distanceKm) => getRoutePointAtDistance(path, distanceKm).elevationM);
  const radius = Math.max(1, Math.round(0.25 / stepKm));
  const elevations = raw.map((_, index) => {
    const from = Math.max(0, index - radius);
    const to = Math.min(raw.length - 1, index + radius);
    let sum = 0;
    for (let cursor = from; cursor <= to; cursor += 1) sum += raw[cursor];
    return sum / (to - from + 1);
  });
  return { distances, elevations };
};

/**
 * Finds the significant climbs and descents with a hysteresis on the smoothed profile: a slope only
 * ends when the elevation reverses by more than the threshold, so small bumps stay inside it.
 */
export const detectRouteSlopes = (path: PreparedAnimationPath): RouteSlope[] => {
  if (!path.canAnimate) return [];
  const { distances, elevations } = sampleElevation(path);
  let totalGain = 0;
  for (let index = 1; index < elevations.length; index += 1) totalGain += Math.max(0, elevations[index] - elevations[index - 1]);
  const threshold = clamp(totalGain * 0.04, 60, 150);

  const turningPoints = [0];
  let direction: "up" | "down" | null = null;
  let extremum = 0;
  let lowest = 0;
  let highest = 0;
  for (let index = 1; index < elevations.length; index += 1) {
    const elevation = elevations[index];
    if (direction === null) {
      // Until the first slope is known, it starts from the lowest or highest point seen so far.
      if (elevation < elevations[lowest]) lowest = index;
      if (elevation > elevations[highest]) highest = index;
      if (elevation - elevations[lowest] >= threshold) {
        turningPoints[0] = lowest;
        direction = "up";
        extremum = index;
      } else if (elevations[highest] - elevation >= threshold) {
        turningPoints[0] = highest;
        direction = "down";
        extremum = index;
      }
      continue;
    }
    const goingFurther = direction === "up" ? elevation > elevations[extremum] : elevation < elevations[extremum];
    if (goingFurther) {
      extremum = index;
    } else if (Math.abs(elevation - elevations[extremum]) >= threshold) {
      turningPoints.push(extremum);
      direction = direction === "up" ? "down" : "up";
      extremum = index;
    }
  }
  if (direction !== null) turningPoints.push(extremum);

  // Flat stretches at either end (a plateau before a climb, a valley floor after a descent) are
  // not part of the slope.
  const flatToleranceM = 10;
  const slopes: RouteSlope[] = [];
  for (let index = 1; index < turningPoints.length; index += 1) {
    let from = turningPoints[index - 1];
    let to = turningPoints[index];
    const startElevation = elevations[from];
    while (from < to && Math.abs(elevations[from + 1] - startElevation) <= flatToleranceM) from += 1;
    const endElevation = elevations[to];
    while (to > from && Math.abs(elevations[to - 1] - endElevation) <= flatToleranceM) to -= 1;
    const change = elevations[to] - elevations[from];
    const lengthKm = distances[to] - distances[from];
    if (Math.abs(change) < threshold || lengthKm <= 0) continue;
    slopes.push({
      kind: change > 0 ? "climb" : "descent",
      startKm: distances[from],
      endKm: distances[to],
      elevationM: Math.abs(change),
      averageGrade: Math.abs(change) / (lengthKm * 1_000),
      startElevationM: elevations[from],
      endElevationM: elevations[to],
    });
  }
  return slopes;
};

/** Default length when the duration is automatic: longer routes get more time, never more than 90 s. */
export const getAutoDurationSeconds = (totalDistanceKm: number) => {
  if (totalDistanceKm < 25) return 30;
  if (totalDistanceKm < 60) return 45;
  if (totalDistanceKm < 120) return 60;
  return 90;
};

const ORDINALS = ["Première", "Deuxième", "Troisième", "Quatrième", "Cinquième", "Sixième"];

const joinFrench = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;

const slopeScore = (slope: RouteSlope) => slope.elevationM * Math.sqrt(Math.max(0.01, slope.averageGrade));

type Candidate = Omit<StoryBeat, "startKm" | "endKm" | "narration"> & {
  priority: number;
  spanStartKm: number;
  spanEndKm: number;
  narration: (order: number) => string;
};

/**
 * Picks the moments worth narrating (start, life bases, the hardest climbs, the biggest descent,
 * aid stations, finish) within a budget that grows with the video length, and writes a factual
 * default narration for each. Spans never overlap so one caption and one narration play at a time.
 */
export const buildStoryBeats = (
  path: PreparedAnimationPath,
  aidStations: VideoAidStation[],
  race: StoryRaceInfo,
  options: { targetSeconds: number; includeAidStations: boolean; includeStart: boolean },
): StoryBeat[] => {
  const total = path.totalDistanceKm;
  if (!path.canAnimate || total <= 0) return [];
  const pointWidthKm = Math.max(0.4, total * 0.02);
  const slopes = detectRouteSlopes(path);
  const climbs = slopes.filter((slope) => slope.kind === "climb").sort((left, right) => slopeScore(right) - slopeScore(left));
  const descents = slopes.filter((slope) => slope.kind === "descent").sort((left, right) => slopeScore(right) - slopeScore(left));

  const candidates: Candidate[] = [];
  if (options.includeStart) {
    candidates.push({
      id: "start",
      kind: "start",
      title: "Départ",
      anchorKm: 0,
      spanStartKm: 0,
      spanEndKm: pointWidthKm,
      facts: race.startDetail ? race.startDetail.split(" · ") : [],
      services: [],
      cutoffTime: null,
      priority: 100,
      narration: () => race.startDetail
        ? `Le départ est donné : ${race.startDetail.split(" · ").join(", ")}.`
        : "Le départ est donné.",
    });
  }

  climbs.slice(0, 4).forEach((climb, rank) => {
    const lengthKm = climb.endKm - climb.startKm;
    candidates.push({
      id: `climb-${Math.round(climb.startKm * 10)}`,
      kind: "climb",
      title: `Montée · km ${formatKm(climb.startKm)}`,
      anchorKm: climb.startKm,
      spanStartKm: climb.startKm,
      spanEndKm: climb.endKm,
      facts: [`${formatKm(lengthKm)} km`, `+${formatNumber(climb.elevationM)} m`, `${formatPercent(climb.averageGrade)} % moy.`],
      services: [],
      cutoffTime: null,
      priority: 85 - rank * 10,
      narration: (order) =>
        `${ORDINALS[order] ?? "Nouvelle"} grosse difficulté au kilomètre ${formatKm(climb.startKm)} : ${formatKm(lengthKm)} kilomètres à ${formatPercent(climb.averageGrade)} pour cent, ${formatNumber(climb.elevationM)} mètres à gravir.`,
    });
  });

  descents.slice(0, 2).forEach((descent, rank) => {
    if (descent.elevationM < 250) return;
    const lengthKm = descent.endKm - descent.startKm;
    candidates.push({
      id: `descent-${Math.round(descent.startKm * 10)}`,
      kind: "descent",
      title: `Descente · km ${formatKm(descent.startKm)}`,
      anchorKm: descent.startKm,
      spanStartKm: descent.startKm,
      spanEndKm: descent.endKm,
      facts: [`${formatKm(lengthKm)} km`, `−${formatNumber(descent.elevationM)} m`, `${formatPercent(descent.averageGrade)} % moy.`],
      services: [],
      cutoffTime: null,
      priority: 60 - rank * 15,
      narration: () =>
        `Place à la descente : ${formatNumber(descent.elevationM)} mètres de dénivelé négatif sur ${formatKm(lengthKm)} kilomètres. Garde des jambes.`,
    });
  });

  if (options.includeAidStations) {
    aidStations.filter((station) => station.distanceKm > 0 && station.distanceKm < total).forEach((station) => {
      const services = getAidStationServices(station);
      const serviceWords = services.map((service) => AID_SERVICES[service].toLowerCase());
      candidates.push({
        id: station.id,
        kind: station.isLifeBase ? "lifeBase" : "aid",
        title: station.name,
        anchorKm: station.distanceKm,
        spanStartKm: station.distanceKm - pointWidthKm,
        spanEndKm: station.distanceKm + pointWidthKm * 0.35,
        facts: [`km ${formatKm(station.distanceKm)}`, ...(station.cutoffTime ? [`Barrière ${station.cutoffTime}`] : [])],
        services,
        cutoffTime: station.cutoffTime,
        priority: station.isLifeBase ? 90 : station.cutoffTime ? 55 : 45,
        narration: () => [
          `${station.isLifeBase ? "Base de vie" : "Ravitaillement"} de ${station.name}, au kilomètre ${formatKm(station.distanceKm)}`,
          serviceWords.length ? ` : ${joinFrench(serviceWords)}.` : ".",
          station.cutoffTime ? ` Barrière horaire à ${station.cutoffTime}.` : "",
        ].join(""),
      });
    });
  }

  candidates.push({
    id: "finish",
    kind: "finish",
    title: "Arrivée",
    anchorKm: total,
    spanStartKm: total - pointWidthKm,
    spanEndKm: total,
    facts: [`${formatNumber(total)} km`],
    services: [],
    cutoffTime: null,
    priority: 95,
    narration: () => `Dernier effort jusqu’à la ligne d’arrivée, après ${formatNumber(total)} kilomètres.`,
  });

  // About one narrated moment every 5.5 s of video, so the voice has room to breathe.
  const budget = clamp(Math.round(options.targetSeconds / 5.5), 3, 14);
  const minimumGapKm = Math.max(0.5, total * 0.035);
  const selected: Candidate[] = [];
  [...candidates].sort((left, right) => right.priority - left.priority).forEach((candidate) => {
    if (selected.length >= budget) return;
    if (selected.some((other) => Math.abs(other.anchorKm - candidate.anchorKm) < minimumGapKm)) return;
    selected.push(candidate);
  });
  selected.sort((left, right) => left.anchorKm - right.anchorKm);

  let climbOrder = 0;
  const routeBeats = selected.map((candidate, index): StoryBeat => {
    const previous = selected[index - 1];
    const next = selected[index + 1];
    // Neighbouring spans are cut halfway between anchors so they never overlap.
    const startKm = clamp(Math.max(candidate.spanStartKm, previous ? (previous.anchorKm + candidate.anchorKm) / 2 : 0), 0, total);
    const endKm = clamp(Math.min(candidate.spanEndKm, next ? (candidate.anchorKm + next.anchorKm) / 2 : total), startKm, total);
    const order = candidate.kind === "climb" ? climbOrder++ : 0;
    const { priority: _priority, spanStartKm: _start, spanEndKm: _end, narration, ...beat } = candidate;
    return { ...beat, startKm, endKm, narration: narration(order) };
  });

  const stats = [
    `${formatNumber(race.distanceKm)} kilomètres`,
    race.elevationGainM ? `${formatNumber(race.elevationGainM)} mètres de dénivelé positif` : null,
  ].filter(Boolean).join(" et ");
  return [
    {
      id: "intro", kind: "intro", title: race.title, startKm: 0, endKm: 0, anchorKm: 0,
      facts: [], services: [], cutoffTime: null,
      narration: `${race.title}. ${stats}. Découvre le parcours.`,
    },
    ...routeBeats,
    {
      id: "outro", kind: "outro", title: "Pace Yourself", startKm: total, endKm: total, anchorKm: total,
      facts: [], services: [], cutoffTime: null,
      narration: "Prépare ton plan de course sur pace-yourself point com.",
    },
  ];
};

/** French speech runs at about 15 characters per second; used until the real audio exists. */
export const estimateNarrationMs = (text: string) => (text.trim() ? 400 + text.trim().length * 66 : 0);
