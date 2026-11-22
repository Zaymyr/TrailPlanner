import type { VideoCompositionSettings } from "../app/admin/video-generator/video-composition";
import type { ParsedGpx } from "./gpx/parseGpx";
import { normalizeImportedWaypoints } from "./gpx/normalizeImportedWaypoints";
import { getReelMode } from "./reel-planner";
import type { VideoGeneratorDetail } from "./video-generator";

/**
 * Pure parts of the organizer flyover video, shared by the browser preview on /survol and the
 * server pipeline (lib/flyover-orders.ts, lib/flyover-generation.ts): the preview and the paid
 * render use the very same composition. No Node or server import here.
 */

type PresetSpec = {
  label: string;
  description: string;
  mapStyle: VideoCompositionSettings["mapStyle"];
  customStyleUrl?: string;
  mapAmbiance: VideoCompositionSettings["mapAmbiance"];
  /** Route colour when the brand green would not stand out (night). */
  routeColor?: string;
  /** Shown on /survol; older presets stay readable for existing orders. */
  offered: boolean;
};

/**
 * The basemaps offered to organizers (2026-11-22: four clearly different looks), mapped onto the
 * editor's style, ambiance and route colour. "relief" and "cinema" are the first presets, kept for
 * the orders that chose them.
 */
export const FLYOVER_MAP_PRESETS = {
  signature: { label: "Pace Yourself", description: "Topographie crème et vert, la signature de la marque.", mapStyle: "paceyourself", mapAmbiance: "brand", offered: true },
  satellite: { label: "Satellite", description: "Imagerie satellite naturelle, en relief.", mapStyle: "classic", mapAmbiance: "natural", offered: true },
  outdoors: { label: "Carte rando", description: "Carte topo colorée : sentiers, courbes, sommets.", mapStyle: "custom", customStyleUrl: "mapbox://styles/mapbox/outdoors-v12", mapAmbiance: "natural", offered: true },
  night: { label: "Nocturne", description: "Satellite de nuit, tracé orange lumineux.", mapStyle: "classic", mapAmbiance: "night", routeColor: "#f0873a", offered: true },
  relief: { label: "Relief 3D", description: "Satellite 3D aux couleurs éclatantes.", mapStyle: "standard", mapAmbiance: "vivid", offered: false },
  cinema: { label: "Cinéma", description: "Satellite contrasté et chaud, ambiance film.", mapStyle: "classic", mapAmbiance: "cinematic", offered: false },
} as const satisfies Record<string, PresetSpec>;
export type FlyoverMapPreset = keyof typeof FLYOVER_MAP_PRESETS;
export const FLYOVER_MAP_PRESET_VALUES = Object.keys(FLYOVER_MAP_PRESETS) as [FlyoverMapPreset, ...FlyoverMapPreset[]];
/** The presets the order form offers. */
export const FLYOVER_OFFERED_PRESETS = FLYOVER_MAP_PRESET_VALUES.filter((key) => FLYOVER_MAP_PRESETS[key].offered);

/** Story modes the organizer chooses between (default from the distance, like the automatic reels). */
export const FLYOVER_STORY_MODES = {
  highlights: { label: "Temps forts", description: "Les montées clés et les ravitos, 30 à 50 s : le format reel." },
  full: { label: "Parcours complet", description: "Tout le tracé du départ à l’arrivée, jusqu’à 2 min." },
} as const;
export type FlyoverStoryMode = keyof typeof FLYOVER_STORY_MODES;
export const FLYOVER_STORY_MODE_VALUES = ["highlights", "full"] as const;

export const FLYOVER_TERRAIN = { min: 1, max: 3, default: 1.8 } as const;
export const FLYOVER_MAX_DISTANCE_KM = 400;

export type GpxCheck = { ok: true; distanceKm: number; gainM: number | null; lossM: number | null } | { ok: false; message: string };

/** A GPX the server can tell: a real trace with altitudes (the server cannot ask the 3D terrain). */
export const checkFlyoverGpx = (gpx: ParsedGpx): GpxCheck => {
  if (gpx.points.length < 2) return { ok: false, message: "Le GPX ne contient pas de tracé." };
  const withElevation = gpx.points.filter((point) => point.ele !== null && Number.isFinite(point.ele)).length;
  if (withElevation < gpx.points.length / 2) return { ok: false, message: "Le GPX n’a pas d’altitudes : exportez-le avec l’altitude depuis votre outil." };
  const distanceKm = gpx.stats.distanceKm;
  if (!(distanceKm > 0.5)) return { ok: false, message: "Le tracé est trop court." };
  if (distanceKm > FLYOVER_MAX_DISTANCE_KM) return { ok: false, message: `Le tracé dépasse ${FLYOVER_MAX_DISTANCE_KM} km.` };
  return { ok: true, distanceKm, gainM: gpx.stats.gainM ?? null, lossM: gpx.stats.lossM ?? null };
};

/** Default mode, same rule as the automatic reels: up to 60 km the whole course, beyond it the highlights. */
export const getFlyoverMode = (distanceKm: number) => getReelMode(distanceKm);

/** The reel settings of an order: the given base (reel defaults of its mode), its basemap and relief. */
export const applyFlyoverSettings = (
  base: VideoCompositionSettings,
  order: { map_preset: FlyoverMapPreset; terrain_exaggeration: number },
): VideoCompositionSettings => {
  const preset: PresetSpec = FLYOVER_MAP_PRESETS[order.map_preset];
  return {
    ...base,
    mapStyle: preset.mapStyle,
    customStyleUrl: preset.customStyleUrl ?? null,
    mapAmbiance: preset.mapAmbiance,
    ...(preset.routeColor ? { routeColor: preset.routeColor } : {}),
    terrainExaggeration: Math.min(FLYOVER_TERRAIN.max, Math.max(FLYOVER_TERRAIN.min, order.terrain_exaggeration)),
  };
};

/** Aid stations carried by the GPX waypoints (start and finish excluded), along the course. */
export const readGpxAidStations = (gpx: ParsedGpx, max = 40): Array<{ name: string; km: number }> =>
  normalizeImportedWaypoints(gpx.points, gpx.waypoints).aidStations
    .map((station) => ({ name: station.name.trim().slice(0, 80), km: Math.round(station.distanceKm * 10) / 10 }))
    .filter((station) => station.name)
    .slice(0, max);

export type FlyoverDetailInput = {
  id: string;
  race_name: string;
  race_date: string | null;
  elevation_gain_m?: number | null;
  elevation_loss_m?: number | null;
  aid_stations: Array<{ id: string; name: string; km: number }>;
};

/** The order as the video generator detail the reel steps read (the order id stands for the race). */
export const buildFlyoverDetail = (order: FlyoverDetailInput, gpx: ParsedGpx): VideoGeneratorDetail => {
  const first = gpx.points[0];
  const year = order.race_date ? Number.parseInt(order.race_date.slice(0, 4), 10) : Number.NaN;
  return {
    race: {
      id: order.id,
      eventId: null,
      eventName: null,
      eventShortName: null,
      name: order.race_name,
      distanceKm: Math.round(gpx.stats.distanceKm * 10) / 10,
      elevationGainM: gpx.stats.gainM ?? order.elevation_gain_m ?? null,
      elevationLossM: gpx.stats.lossM ?? order.elevation_loss_m ?? null,
      editionYear: Number.isInteger(year) ? year : null,
      raceDate: order.race_date,
    },
    aidStations: order.aid_stations.map((station) => ({
      id: station.id,
      name: station.name,
      distanceKm: station.km,
      waterAvailable: true,
      foodAvailable: true,
      assistanceAllowed: true,
      isLifeBase: false,
      dropBagAvailable: false,
      cutoffTime: null,
    })),
    gpx: {
      status: "ready",
      pointCount: gpx.points.length,
      bounds: {
        minLat: gpx.stats.boundsMinLat ?? first.lat,
        minLon: gpx.stats.boundsMinLng ?? first.lng,
        maxLat: gpx.stats.boundsMaxLat ?? first.lat,
        maxLon: gpx.stats.boundsMaxLng ?? first.lng,
      },
      points: gpx.points.map((point) => ({ lat: point.lat, lon: point.lng, elevationM: point.ele, distanceKm: point.distKmCum })),
    },
  } as VideoGeneratorDetail;
};
