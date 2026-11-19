import type { VideoAidStation } from "../../../lib/video-generator";

/**
 * Canonical figures of a reel: one source of truth for every number shown, spoken or sent to the
 * script and caption writers (see docs/08-decisions/2026-11-19-reel-highlights-and-figures.md).
 *
 * The race record (races.distance_km, races.elevation_gain_m) is the announced truth. The GPX only
 * places things along the route: a GPX kilometre or a GPX D+ is rescaled to the announced total
 * before it is shown, so the kilometre counter ends on the badge figure and the legs add up to it.
 * A race figure too far from the GPX (wrong GPX, typo) is set aside: the GPX is used everywhere
 * instead, so the badge and the counter still agree, and a warning explains why.
 *
 * Internally the camera, the story and the timeline keep working in route (GPX) kilometres; aid
 * stations, whose kilometres come from the organizer (announced scale), are converted to route
 * kilometres once with toRouteAidStations.
 */

/** A race distance within ±15 % of the GPX length is trusted and rescales the GPX kilometres. */
export const DISTANCE_TOLERANCE = 0.15;
/** GPX D+ depends on smoothing far more than its length: a race D+ within ±35 % is trusted. */
export const ELEVATION_TOLERANCE = 0.35;

export type RaceFigures = {
  /** Announced total distance (km), shown on the badge, the counter and in the intro. */
  distanceKm: number;
  /** Announced total D+ (m), or null when neither the race nor the GPX gives one. */
  elevationGainM: number | null;
  distanceSource: "race" | "route";
  elevationSource: "race" | "route" | "none";
  /** Announced kilometres per route (GPX) kilometre. */
  kmScale: number;
  /** Announced metres of D+ per route (GPX) metre of D+. */
  gainScale: number;
  routeDistanceKm: number;
  /** Why a race figure was set aside, logged by the editor. */
  warnings: string[];
};

export type RaceFiguresInput = {
  raceDistanceKm: number | null | undefined;
  raceElevationGainM: number | null | undefined;
  routeDistanceKm: number;
  routeElevationGainM: number;
};

const isPositive = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const withinTolerance = (value: number, reference: number, tolerance: number) =>
  Math.abs(value - reference) <= reference * tolerance;

export const buildRaceFigures = ({
  raceDistanceKm,
  raceElevationGainM,
  routeDistanceKm,
  routeElevationGainM,
}: RaceFiguresInput): RaceFigures => {
  const warnings: string[] = [];
  const hasRoute = isPositive(routeDistanceKm);

  let distanceKm = hasRoute ? routeDistanceKm : 0;
  let distanceSource: RaceFigures["distanceSource"] = "route";
  if (isPositive(raceDistanceKm)) {
    if (!hasRoute || withinTolerance(raceDistanceKm, routeDistanceKm, DISTANCE_TOLERANCE)) {
      distanceKm = raceDistanceKm;
      distanceSource = "race";
    } else {
      warnings.push(`Distance de la course (${raceDistanceKm} km) trop éloignée du GPX (${routeDistanceKm.toFixed(1)} km) : le GPX est utilisé.`);
    }
  }

  const hasRouteGain = isPositive(routeElevationGainM);
  let elevationGainM: number | null = hasRouteGain ? routeElevationGainM : null;
  let elevationSource: RaceFigures["elevationSource"] = hasRouteGain ? "route" : "none";
  if (isPositive(raceElevationGainM)) {
    if (!hasRouteGain || withinTolerance(raceElevationGainM, routeElevationGainM, ELEVATION_TOLERANCE)) {
      elevationGainM = raceElevationGainM;
      elevationSource = "race";
    } else {
      warnings.push(`D+ de la course (${raceElevationGainM} m) trop éloigné du GPX (${Math.round(routeElevationGainM)} m) : le GPX est utilisé.`);
    }
  }

  return {
    distanceKm,
    elevationGainM,
    distanceSource,
    elevationSource,
    kmScale: distanceSource === "race" && hasRoute ? distanceKm / routeDistanceKm : 1,
    gainScale: elevationSource === "race" && hasRouteGain ? raceElevationGainM! / routeElevationGainM : 1,
    routeDistanceKm: hasRoute ? routeDistanceKm : 0,
    warnings,
  };
};

/** Figures of a route alone (no race record): the GPX is shown as is. */
export const buildRouteFigures = (routeDistanceKm: number, routeElevationGainM: number) =>
  buildRaceFigures({ raceDistanceKm: null, raceElevationGainM: null, routeDistanceKm, routeElevationGainM });

export const toAnnouncedKm = (figures: RaceFigures, routeKm: number) => routeKm * figures.kmScale;
export const toRouteKm = (figures: RaceFigures, announcedKm: number) => announcedKm / figures.kmScale;
export const toAnnouncedElevationM = (figures: RaceFigures, routeElevationM: number) => routeElevationM * figures.gainScale;

/** Organizer stations (announced kilometres) placed on the GPX: their kilometre in route scale. */
export const toRouteAidStations = (figures: RaceFigures, stations: VideoAidStation[]): VideoAidStation[] =>
  figures.kmScale === 1 ? stations : stations.map((station) => ({ ...station, distanceKm: toRouteKm(figures, station.distanceKm) }));

// --- Rounding policy (the only one used by the overlay, the story, the cards and the AI inputs) ---
//
// - Total distance: whole kilometres from 10 km ("67 km"), one decimal below ("8,5 km").
// - Positions and partial lengths: one decimal, ",0" dropped in text ("km 12,4", "km 30");
//   the on-screen counter keeps the decimal so it does not jump in width ("KM 30,0").
// - D+ computed from the GPX (leg, climb, cumulative at a station): nearest 10 m ("+540 m").
//   The announced race D+ is shown as announced (it is already the truth, not a measurement).

const formatNumber = (value: number, digits: number) =>
  value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const roundTotalKm = (km: number) => (km >= 10 ? Math.round(km) : Math.round(km * 10) / 10);

export const formatTotalKm = (km: number) => {
  const rounded = roundTotalKm(km);
  return formatNumber(rounded, Number.isInteger(rounded) ? 0 : 1);
};

export const roundKm = (km: number) => Math.round(km * 10) / 10;

/** Position or partial length in text: one decimal, ",0" dropped. */
export const formatKm = (km: number) => {
  const rounded = roundKm(km);
  return formatNumber(rounded, Number.isInteger(rounded) ? 0 : 1);
};

/** Position on the live counter: always one decimal. */
export const formatKmFixed = (km: number) => formatNumber(roundKm(km), 1);

export const roundElevationM = (meters: number) => Math.round(meters / 10) * 10;

/** D+ computed from the GPX, already rescaled: nearest 10 m. */
export const formatElevationM = (meters: number) => formatNumber(roundElevationM(meters), 0);

/** Total D+ as announced (race record), or rounded like any GPX figure when it comes from the GPX. */
export const formatTotalElevationM = (figures: RaceFigures) => {
  if (figures.elevationGainM === null) return null;
  return figures.elevationSource === "race"
    ? formatNumber(Math.round(figures.elevationGainM), 0)
    : formatElevationM(figures.elevationGainM);
};

/** Total D+ as a number for the AI inputs, with the same rounding as its display. */
export const getAnnouncedElevationGainM = (figures: RaceFigures) => {
  if (figures.elevationGainM === null) return null;
  return figures.elevationSource === "race" ? Math.round(figures.elevationGainM) : roundElevationM(figures.elevationGainM);
};
