import type { VideoAidStation } from "../../../lib/video-generator";
import type { RaceFigures } from "./race-figures";
import type { PreparedAnimationPath } from "./route-animation";
import { formatClockTime, getDaylightAt, type RaceClock } from "./route-clock";
import {
  createStoryFormatter,
  detectRouteSlopes,
  formatPercent,
  getAidStationServices,
  getSlopeId,
  resolveStoryFigures,
  type RouteSlope,
  type StoryBeat,
  type StoryBeatKind,
  type StoryLandmarks,
  type StoryRaceInfo,
} from "./route-story";

/**
 * "Reel temps forts": instead of flying the whole course, the reel dwells on 3 to 5 key moments
 * and jumps between them. This module picks those moments (pure and deterministic) and turns them
 * into story beats; the timeline (video-composition) gives each its dwell and a short transit.
 */

export type HighlightKind =
  | "hardestClimb"
  | "lastClimb"
  | "biggestDescent"
  | "strategicAid"
  | "night"
  /** Fillers when the course has fewer remarkable moments. */
  | "climb"
  | "descent";

export type Highlight = {
  /** Stable across renders of the same route: narration overrides and voice clips use it. */
  id: string;
  kind: HighlightKind;
  /** Route (GPX) kilometres the camera dwells on. */
  startKm: number;
  endKm: number;
  anchorKm: number;
  /** Short facts in the announced scale, shown in the caption and sent to the script writer. */
  facts: string[];
  slope: RouteSlope | null;
  station: VideoAidStation | null;
  /** The station is the last one before the hardest climb. */
  beforeHardestClimb: boolean;
  /** Night passage: estimated local time (minutes of day) when it starts, and where it ends. */
  nightStartMinutes: number | null;
  nightEndKm: number | null;
  /** Stations too close to this moment to get their own: mentioned with it. */
  nearbyStations: VideoAidStation[];
  priority: number;
};

export const MIN_HIGHLIGHTS = 3;
export const MAX_HIGHLIGHTS = 5;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

const slopeScore = (slope: RouteSlope) => slope.elevationM * Math.sqrt(Math.max(0.01, slope.averageGrade));

type Candidate = Omit<Highlight, "id" | "facts" | "nearbyStations"> & { nearbyStations: VideoAidStation[] };

/** Dwell span around a point moment (station, nightfall): about 1 % of the route. */
export const getPointWindowKm = (totalKm: number) => clamp(totalKm * 0.012, 0.6, 2);

/** First night stretch of the estimated race clock, when it lasts at least 3 % of the route. */
export const findNightPassage = (clock: RaceClock | null, totalKm: number) => {
  if (!clock || totalKm <= 0) return null;
  const steps = 240;
  const isNight = Array.from({ length: steps + 1 }, (_, index) => getDaylightAt(clock, (totalKm * index) / steps).isNight);
  const start = isNight.indexOf(true);
  if (start < 0) return null;
  let end = start;
  while (end < steps && isNight[end + 1]) end += 1;
  const startKm = (totalKm * start) / steps;
  const endKm = (totalKm * end) / steps;
  if (endKm - startKm < totalKm * 0.03) return null;
  return { startKm, endKm, startMinutes: getDaylightAt(clock, startKm).minutesOfDay };
};

const slopeCandidate = (kind: HighlightKind, slope: RouteSlope, priority: number): Candidate => ({
  kind,
  startKm: slope.startKm,
  endKm: slope.endKm,
  anchorKm: slope.startKm,
  slope,
  station: null,
  beforeHardestClimb: false,
  nightStartMinutes: null,
  nightEndKm: null,
  nearbyStations: [],
  priority,
});

/**
 * Picks the key moments, most important first, then keeps them in course order:
 * 1. the hardest climb (D+ weighted by the square root of its mean grade, so a long steady climb
 *    and a short wall compare fairly);
 * 2. the last station before that climb (the place to refuel before it);
 * 3. the last significant climb of the second half (at least 30 % of the hardest one);
 * 4. the biggest descent;
 * 5. the first night stretch of the estimated race clock;
 * 6. other strategic stations: life base with a cutoff, then cutoff, then life base, in course order;
 * then other climbs and descents fill up to 3 moments. Moments whose spans overlap (100 m margin)
 * are not both kept: a station inside a kept moment is mentioned with it instead. At most 5.
 */
export const selectHighlights = (
  path: PreparedAnimationPath,
  aidStations: VideoAidStation[],
  raceClock: RaceClock | null,
  figures: RaceFigures,
  options: { landmarks?: StoryLandmarks } = {},
): Highlight[] => {
  const total = path.totalDistanceKm;
  if (!path.canAnimate || total <= 0) return [];
  const slopes = detectRouteSlopes(path);
  const climbs = slopes
    .filter((slope) => slope.kind === "climb")
    .sort((left, right) => slopeScore(right) - slopeScore(left) || left.startKm - right.startKm);
  const descents = slopes
    .filter((slope) => slope.kind === "descent")
    .sort((left, right) => right.elevationM - left.elevationM || left.startKm - right.startKm);
  const stations = aidStations
    .filter((station) => station.distanceKm > 0 && station.distanceKm < total)
    .sort((left, right) => left.distanceKm - right.distanceKm || left.id.localeCompare(right.id));
  const pointWindowKm = getPointWindowKm(total);
  const stationCandidate = (station: VideoAidStation, priority: number, beforeHardestClimb = false): Candidate => ({
    kind: "strategicAid",
    startKm: clamp(station.distanceKm - pointWindowKm / 2, 0, total),
    endKm: clamp(station.distanceKm + pointWindowKm / 2, 0, total),
    anchorKm: station.distanceKm,
    slope: null,
    station,
    beforeHardestClimb,
    nightStartMinutes: null,
    nightEndKm: null,
    nearbyStations: [],
    priority,
  });

  const candidates: Candidate[] = [];
  const hardest = climbs[0] ?? null;
  let refuel: VideoAidStation | null = null;
  if (hardest) {
    candidates.push(slopeCandidate("hardestClimb", hardest, 100));
    const reach = Math.max(5, total * 0.15);
    refuel = [...stations].reverse().find((station) => station.distanceKm <= hardest.startKm + 0.1 && station.distanceKm >= hardest.startKm - reach) ?? null;
    if (refuel) candidates.push(stationCandidate(refuel, 85, true));
    const last = [...climbs]
      .filter((climb) => climb !== hardest && climb.endKm >= total * 0.6 && climb.elevationM >= Math.max(100, hardest.elevationM * 0.3))
      .sort((left, right) => right.endKm - left.endKm)[0];
    if (last && last.endKm > hardest.endKm) candidates.push(slopeCandidate("lastClimb", last, 75));
  }
  if (descents[0]) candidates.push(slopeCandidate("biggestDescent", descents[0], 65));
  const night = findNightPassage(raceClock, total);
  if (night) {
    candidates.push({
      kind: "night",
      startKm: night.startKm,
      endKm: clamp(night.startKm + pointWindowKm, 0, total),
      anchorKm: night.startKm,
      slope: null,
      station: null,
      beforeHardestClimb: false,
      nightStartMinutes: night.startMinutes,
      nightEndKm: night.endKm,
      nearbyStations: [],
      priority: 55,
    });
  }
  const stationRank = (station: VideoAidStation) => (station.isLifeBase ? 1 : 0) + (station.cutoffTime ? 2 : 0);
  stations
    .filter((station) => station !== refuel && stationRank(station) > 0)
    .sort((left, right) => stationRank(right) - stationRank(left) || left.distanceKm - right.distanceKm)
    .forEach((station, index) => candidates.push(stationCandidate(station, 45 - index * 0.1)));
  climbs.slice(1).forEach((climb, index) => candidates.push(slopeCandidate("climb", climb, 30 - index * 0.1)));
  descents.slice(1).forEach((descent, index) => candidates.push(slopeCandidate("descent", descent, 20 - index * 0.1)));

  // Greedy pick by priority: fillers only count while fewer than 3 moments are kept. Spans may
  // touch (a descent right after a summit) but not overlap.
  const marginKm = 0.1;
  const kept: Candidate[] = [];
  candidates
    .sort((left, right) => right.priority - left.priority || left.startKm - right.startKm)
    .forEach((candidate) => {
      const isFiller = candidate.priority < 40;
      if (kept.length >= MAX_HIGHLIGHTS || (isFiller && kept.length >= MIN_HIGHLIGHTS)) return;
      if (kept.some((other) => other.slope && other.slope === candidate.slope)) return;
      const clash = kept.find((other) => candidate.startKm < other.endKm + marginKm && other.startKm < candidate.endKm + marginKm);
      if (clash) {
        if (candidate.station && clash.station?.id !== candidate.station.id && !clash.nearbyStations.includes(candidate.station)) {
          clash.nearbyStations.push(candidate.station);
        }
        return;
      }
      kept.push({ ...candidate, nearbyStations: [...candidate.nearbyStations] });
    });

  // Stations right inside a kept climb or descent are worth a word with it.
  kept.forEach((moment) => {
    if (moment.station) return;
    stations
      .filter((station) => station.distanceKm >= moment.startKm && station.distanceKm <= moment.endKm)
      .forEach((station) => {
        if (!moment.nearbyStations.includes(station)) moment.nearbyStations.push(station);
      });
    moment.nearbyStations.sort((left, right) => left.distanceKm - right.distanceKm);
  });

  const format = createStoryFormatter(figures);
  const landmarks = options.landmarks ?? {};
  return kept
    .sort((left, right) => left.startKm - right.startKm)
    .map((moment): Highlight => {
      const summit = moment.slope?.kind === "climb" ? landmarks[getSlopeId(moment.slope)] ?? null : null;
      const daylight = raceClock ? getDaylightAt(raceClock, moment.anchorKm) : null;
      const facts: Array<string | null> = [];
      if (moment.slope) {
        const lengthKm = moment.slope.endKm - moment.slope.startKm;
        facts.push(`${format.length(lengthKm)} km`);
        facts.push(moment.slope.kind === "climb" ? `+${format.gain(moment.slope.elevationM)} m` : `−${format.loss(moment.slope.elevationM)} m`);
        facts.push(`${formatPercent(moment.slope.averageGrade)} %`);
        facts.push(summit ? `▲ ${summit}` : null);
      } else if (moment.station) {
        facts.push(`km ${format.km(moment.station.distanceKm)}`);
        facts.push(moment.station.isLifeBase ? "Base de vie" : null);
        facts.push(moment.station.cutoffTime ? `Barrière ${moment.station.cutoffTime}` : null);
        facts.push(moment.beforeHardestClimb ? "Dernier ravito avant la plus grosse montée" : null);
      } else if (moment.kind === "night") {
        facts.push(`km ${format.km(moment.startKm)} → ${format.km(moment.nightEndKm ?? moment.endKm)} de nuit`);
      }
      if (daylight) facts.push(`≈ ${formatClockTime(daylight.minutesOfDay)}${daylight.isNight ? " · nuit" : ""}`);
      moment.nearbyStations.forEach((station) => facts.push(`Ravito ${station.name} km ${format.km(station.distanceKm)}`));
      return {
        ...moment,
        id: `hl-${moment.kind}-${moment.station ? moment.station.id : Math.round(moment.anchorKm * 10)}`,
        facts: facts.filter((fact): fact is string => Boolean(fact)).slice(0, 8),
      };
    });
};

const BEAT_KINDS: Record<HighlightKind, StoryBeatKind> = {
  hardestClimb: "climb",
  lastClimb: "climb",
  climb: "climb",
  biggestDescent: "descent",
  descent: "descent",
  strategicAid: "aid",
  night: "night",
};

/**
 * Story beats of a highlights reel: a short intro, one beat per moment (its span is the camera
 * dwell) and a short outro. Default narrations are kept short (about 4 s each) so the reel fits
 * in 30 to 45 s before the AI rewrites them; every number comes from the canonical figures.
 */
export const buildHighlightBeats = (
  highlights: Highlight[],
  path: PreparedAnimationPath,
  race: StoryRaceInfo,
  options: { figures?: RaceFigures; landmarks?: StoryLandmarks } = {},
): StoryBeat[] => {
  const total = path.totalDistanceKm;
  if (!path.canAnimate || total <= 0) return [];
  const format = createStoryFormatter(resolveStoryFigures(path, race, options.figures));
  const landmarks = options.landmarks ?? {};
  const totalGain = format.totalGain();

  const momentBeats = highlights.map((highlight): StoryBeat => {
    const slope = highlight.slope;
    const summit = slope?.kind === "climb" ? landmarks[getSlopeId(slope)] ?? null : null;
    const station = highlight.station;
    let title: string;
    let narration: string;
    if (slope && slope.kind === "climb") {
      const length = format.length(slope.endKm - slope.startKm);
      const gain = format.gain(slope.elevationM);
      const grade = formatPercent(slope.averageGrade);
      if (highlight.kind === "hardestClimb") {
        title = summit ? `Montée vers ${summit}` : "La plus grosse montée";
        narration = `Le gros morceau${summit ? `, vers ${summit}` : ""} : ${length} km à ${grade} %, +${gain} m. Mode diesel !`;
      } else if (highlight.kind === "lastClimb") {
        title = summit ? `Dernière montée vers ${summit}` : "La dernière montée";
        narration = `Dernière montée au km ${format.km(slope.startKm)} : +${gain} m. Garde du jus pour elle.`;
      } else {
        title = summit ?? "Une belle montée";
        narration = `Ça grimpe au km ${format.km(slope.startKm)} : +${gain} m à ${grade} %.`;
      }
    } else if (slope) {
      const loss = format.loss(slope.elevationM);
      const length = format.length(slope.endKm - slope.startKm);
      title = highlight.kind === "biggestDescent" ? "La grande descente" : "Une descente";
      narration = highlight.kind === "biggestDescent"
        ? `La grande descente : −${loss} m sur ${length} km. Garde des cuisses !`
        : `Ça descend au km ${format.km(slope.startKm)} : −${loss} m.`;
    } else if (station) {
      title = station.name;
      const where = `${station.isLifeBase ? "Base de vie" : "Ravito"} de ${station.name}, km ${format.km(station.distanceKm)}`;
      const cutoff = station.cutoffTime ? `, barrière ${station.cutoffTime}` : "";
      narration = highlight.beforeHardestClimb
        ? `${where}${cutoff} : fais le plein avant la grosse montée.`
        : `${where}${cutoff}. ${station.isLifeBase ? "Prends le temps de manger." : "Ne traîne pas."}`;
    } else {
      title = "Passage de nuit";
      const clock = highlight.nightStartMinutes !== null ? formatClockTime(highlight.nightStartMinutes) : null;
      narration = highlight.startKm <= total * 0.01
        ? "Départ de nuit : frontale réglée dès le premier kilomètre."
        : `${clock ? `Vers ${clock}, l` : "L"}a nuit tombe au km ${format.km(highlight.startKm)} : frontale prête.`;
    }
    return {
      id: highlight.id,
      kind: station ? (station.isLifeBase ? "lifeBase" : "aid") : BEAT_KINDS[highlight.kind],
      title,
      startKm: highlight.startKm,
      endKm: highlight.endKm,
      anchorKm: highlight.anchorKm,
      facts: highlight.facts,
      services: station ? getAidStationServices(station) : [],
      cutoffTime: station?.cutoffTime ?? null,
      narration,
      pauseMs: 0,
    };
  });

  return [
    {
      // Own ids: the full story already uses "intro" / "outro" for its texts and clips.
      id: "hl-intro", kind: "intro", title: race.title, startKm: 0, endKm: 0, anchorKm: 0,
      facts: [], services: [], cutoffTime: null,
      narration: `${race.title} : ${format.total()} km${totalGain ? `, ${totalGain} m D+` : ""}. Les temps forts !`,
    },
    ...momentBeats,
    {
      id: "hl-outro", kind: "outro", title: "Pace Yourself", startKm: total, endKm: total, anchorKm: total,
      facts: [], services: [], cutoffTime: null,
      narration: "Prépare ta course avec l’appli Pace Yourself.",
    },
  ];
};
