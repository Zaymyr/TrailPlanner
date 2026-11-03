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

export type StoryBeatKind = "intro" | "start" | "climb" | "descent" | "flat" | "aid" | "lifeBase" | "finish" | "outro";

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
  /** Extra hold at the start of the beat (a stop at a life base or aid station). */
  pauseMs?: number;
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
// One decimal below 10 km, except for whole numbers ("1 kilomètre", not "1,0").
const formatKm = (value: number) => formatNumber(value, value < 10 && Math.abs(value - Math.round(value)) >= 0.05 ? 1 : 0);
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

/** Reels never exceed two minutes. */
export const MAX_VIDEO_SECONDS = 120;

/** Shortest automatic length: longer routes get more time; the story may need more, up to 2 min. */
export const getAutoDurationSeconds = (totalDistanceKm: number) => {
  if (totalDistanceKm < 25) return 30;
  if (totalDistanceKm < 60) return 45;
  if (totalDistanceKm < 120) return 60;
  return 90;
};

const slopeScore = (slope: RouteSlope) => slope.elevationM * Math.sqrt(Math.max(0.01, slope.averageGrade));

/** Stable id of a slope, used to attach a summit name fetched from the map. */
export const getSlopeId = (slope: Pick<RouteSlope, "kind" | "startKm">) => `${slope.kind}-${Math.round(slope.startKm * 10)}`;

/** Summit names by climb id (see getSlopeId), resolved from Mapbox peaks near each climb top. */
export type StoryLandmarks = Record<string, string>;

export type StoryOptions = {
  /** Upper bound of the whole video; the story keeps about one leg per 5.5 s of it. */
  maxSeconds: number;
  includeAidStations: boolean;
  includeStart: boolean;
  landmarks?: StoryLandmarks;
  /** Estimated time of day at a distance, for night / sunrise mentions (see route-clock). */
  daylightAt?: (distanceKm: number) => { minutesOfDay: number; isNight: boolean } | null;
};

type Boundary = { km: number; priority: number; climb?: RouteSlope; station?: VideoAidStation };

// Holds at stations: the camera lingers a moment, longer at a life base.
export const LIFE_BASE_PAUSE_MS = 2_200;
export const AID_PAUSE_MS = 900;

const formatClock = (minutesOfDay: number) => {
  const minutes = ((Math.round(minutesOfDay) % 1_440) + 1_440) % 1_440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

const joinFrench = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;

const servicesSentence = (station: VideoAidStation) => {
  const words = getAidStationServices(station).map((service) => AID_SERVICES[service].toLowerCase());
  return words.length ? ` : ${joinFrench(words)}` : "";
};

const elevationChange = (path: PreparedAnimationPath, startKm: number, endKm: number) => {
  let gain = 0;
  let loss = 0;
  let previous: number | null = null;
  // Same ±250 m smoothing spirit as slope detection: ignore sub-5 m jitter.
  path.samples.forEach((sample) => {
    if (sample.distanceKm < startKm || sample.distanceKm > endKm) return;
    if (previous === null) {
      previous = sample.elevationM;
      return;
    }
    const delta = sample.elevationM - previous;
    if (Math.abs(delta) < 5) return;
    if (delta > 0) gain += delta;
    else loss -= delta;
    previous = sample.elevationM;
  });
  return { gain, loss };
};

/**
 * Tells the route as one continuous story. The route is cut into consecutive legs at the foot and
 * top of the main climbs, at life bases and, when the budget allows, at aid stations; every leg
 * says what is coming until the next one ("no difficulty until the foot of the climb, settle into
 * a comfortable pace"). Aid stations inside a leg are only mentioned in passing. Legs cover the
 * whole route, so the narration also drives the camera between key points.
 */
export const buildStoryBeats = (
  path: PreparedAnimationPath,
  aidStations: VideoAidStation[],
  race: StoryRaceInfo,
  options: StoryOptions,
): StoryBeat[] => {
  const total = path.totalDistanceKm;
  if (!path.canAnimate || total <= 0) return [];
  const landmarks = options.landmarks ?? {};
  const slopes = detectRouteSlopes(path);
  const climbs = slopes.filter((slope) => slope.kind === "climb").sort((left, right) => slopeScore(right) - slopeScore(left));
  const stations = options.includeAidStations
    ? aidStations.filter((station) => station.distanceKm > 0 && station.distanceKm < total).sort((left, right) => left.distanceKm - right.distanceKm)
    : [];

  // Candidate cut points, most important first.
  const candidates: Boundary[] = [];
  climbs.slice(0, 5).forEach((climb, rank) => {
    candidates.push({ km: climb.startKm, priority: 90 - rank * 8, climb });
    candidates.push({ km: climb.endKm, priority: 70 - rank * 8 });
  });
  stations.forEach((station) => candidates.push({
    km: station.distanceKm,
    priority: station.isLifeBase ? 88 : station.cutoffTime ? 55 : 50,
    station,
  }));

  // Intro and outro take about 8 s; each leg needs about 5.5 s to be told comfortably.
  const maxLegs = clamp(Math.floor((options.maxSeconds - 8) / 5.5), 2, 20);
  // Legs shorter than this are not worth a sentence: a nearby station joins the next cut instead.
  const minimumLegKm = Math.max(1, total * 0.04);
  const cuts: Boundary[] = [];
  [...candidates].sort((left, right) => right.priority - left.priority).forEach((candidate) => {
    if (cuts.length + 1 >= maxLegs) return;
    if (candidate.km < minimumLegKm || total - candidate.km < minimumLegKm) return;
    const clash = cuts.find((cut) => Math.abs(cut.km - candidate.km) < minimumLegKm);
    if (clash) {
      // A station right at a climb foot shares the cut instead of being dropped.
      if (candidate.station && !clash.station) clash.station = candidate.station;
      if (candidate.climb && !clash.climb) clash.climb = candidate.climb;
      return;
    }
    cuts.push({ ...candidate });
  });
  cuts.sort((left, right) => left.km - right.km);
  const bounds = [0, ...cuts.map((cut) => cut.km), total];
  const climbAt = (km: number) => cuts.find((cut) => cut.km === km)?.climb;
  const stationAt = (km: number) => cuts.find((cut) => cut.km === km)?.station;
  const startPlace = race.startDetail?.split(" · ")[0] ?? null;

  type Leg = {
    startKm: number;
    endKm: number;
    gain: number;
    loss: number;
    climb?: RouteSlope;
    station?: VideoAidStation;
    passing: VideoAidStation[];
    kind: StoryBeatKind;
    summit: string | null;
  };
  const legs: Leg[] = bounds.slice(0, -1).map((startKm, index) => {
    const endKm = bounds[index + 1];
    const { gain, loss } = elevationChange(path, startKm, endKm);
    const lengthKm = endKm - startKm;
    const climb = climbAt(startKm);
    const station = index === 0 ? undefined : stationAt(startKm);
    const isClimb = Boolean(climb) || (gain >= 150 && gain / (lengthKm * 1_000) >= 0.05);
    const isDescent = !isClimb && loss >= 150 && loss / (lengthKm * 1_000) >= 0.04;
    const kind: StoryBeatKind = index === 0 && options.includeStart ? "start"
      : isClimb ? "climb"
        : isDescent ? "descent"
          : station?.isLifeBase ? "lifeBase"
            : station ? "aid"
              : index === bounds.length - 2 ? "finish"
                : "flat";
    return {
      startKm,
      endKm,
      gain,
      loss,
      climb,
      station,
      passing: stations.filter((candidate) => candidate.distanceKm > startKm + 0.05 && candidate.distanceKm < endKm - 0.05
        && !cuts.some((cut) => cut.station?.id === candidate.id)),
      kind,
      summit: climb ? landmarks[getSlopeId(climb)] ?? null : null,
    };
  });

  let climbCount = 0;
  const routeBeats = legs.map((leg, index): StoryBeat => {
    const lengthKm = leg.endKm - leg.startKm;
    const next = legs[index + 1];
    const isLast = !next;
    const grade = leg.gain / Math.max(1, lengthKm * 1_000);
    const parts: string[] = [];

    if (index === 0) parts.push(startPlace ? `Départ : ${startPlace}.` : "C’est parti.");
    if (leg.station) {
      parts.push(`${leg.station.isLifeBase ? "Base de vie" : "Ravito"} de ${leg.station.name}, kilomètre ${formatKm(leg.station.distanceKm)}${servicesSentence(leg.station)}.`);
    }
    if (leg.kind === "climb") {
      climbCount += 1;
      const name = leg.summit ? `la montée vers ${leg.summit}` : climbCount === 1 ? "la première grosse montée" : "une nouvelle montée";
      parts.push(`${name.charAt(0).toUpperCase()}${name.slice(1)} : ${formatKm(lengthKm)} kilomètres à ${formatPercent(grade)} pour cent, ${formatNumber(leg.gain)} mètres à gravir. Prends ton temps.`);
    } else if (leg.kind === "descent") {
      parts.push(`On bascule dans la descente : ${formatNumber(leg.loss)} mètres à perdre sur ${formatKm(lengthKm)} kilomètres.`);
    } else {
      const until = isLast ? "jusqu’à l’arrivée"
        : next.kind === "climb" ? `jusqu’au pied de ${next.summit ? `la montée vers ${next.summit}` : "la prochaine montée"}`
          : next.station ? `${next.station.isLifeBase ? "jusqu’à la base de vie" : "jusqu’au ravito"} de ${next.station.name}`
            : "";
      parts.push(`${formatKm(lengthKm)} ${lengthKm < 1.5 ? "kilomètre" : "kilomètres"} sans grosse difficulté${until ? ` ${until}` : ""} : avance à un rythme confortable.`);
    }
    leg.passing.forEach((station) => parts.push(`Au passage, ravito de ${station.name} au kilomètre ${formatKm(station.distanceKm)}.`));
    const lightAtStart = options.daylightAt?.(leg.startKm) ?? null;
    const lightAtEnd = options.daylightAt?.(leg.endKm) ?? null;
    if (lightAtStart && lightAtEnd) {
      if (lightAtStart.isNight && !lightAtEnd.isNight) parts.push("Le jour se lève sur ce tronçon.");
      else if (!lightAtStart.isNight && lightAtEnd.isNight) parts.push("La nuit tombe : sors la frontale.");
      else if (lightAtStart.isNight && leg.kind === "climb") parts.push("De nuit : frontale bien réglée.");
    }
    if (isLast) parts.push(`Ligne d’arrivée au kilomètre ${formatNumber(total)}.`);

    const facts = [
      `${formatKm(lengthKm)} km`,
      leg.gain >= 30 ? `+${formatNumber(leg.gain)} m` : null,
      leg.loss >= 30 ? `−${formatNumber(leg.loss)} m` : null,
      leg.summit ? `▲ ${leg.summit}` : null,
      lightAtStart ? `≈ ${formatClock(lightAtStart.minutesOfDay)}${lightAtStart.isNight ? " · nuit" : ""}` : null,
      ...leg.passing.map((station) => `Ravito ${station.name} km ${formatKm(station.distanceKm)}`),
    ].filter((fact): fact is string => Boolean(fact));

    return {
      id: `leg-${Math.round(leg.startKm * 10)}`,
      kind: leg.kind,
      title: leg.station?.name ?? leg.summit ?? (index === 0 && startPlace ? startPlace : `km ${formatKm(leg.startKm)} → ${formatKm(leg.endKm)}`),
      startKm: leg.startKm,
      endKm: leg.endKm,
      anchorKm: leg.station?.distanceKm ?? leg.startKm,
      facts,
      services: leg.station ? getAidStationServices(leg.station) : [],
      cutoffTime: leg.station?.cutoffTime ?? null,
      narration: parts.join(" "),
      pauseMs: leg.station ? (leg.station.isLifeBase ? LIFE_BASE_PAUSE_MS : AID_PAUSE_MS) : 0,
    };
  });

  const stats = [
    `${formatNumber(race.distanceKm)} kilomètres`,
    race.elevationGainM ? `${formatNumber(race.elevationGainM)} mètres de dénivelé positif` : null,
  ].filter(Boolean).join(" et ");
  return [
    {
      id: "intro", kind: "intro", title: race.title, startKm: 0, endKm: 0, anchorKm: 0,
      facts: [], services: [], cutoffTime: null,
      narration: `${race.title}. ${stats}. Voici ce qui t’attend.`,
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
