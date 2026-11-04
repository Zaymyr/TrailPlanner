"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapboxEvent,
} from "mapbox-gl";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { buildMarkerGeoJson, buildRouteGeoJson, type VideoAidStation } from "../../../lib/video-generator";
import { narrationScriptResponseSchema, narrationVoiceResponseSchema } from "../../../lib/video-narration";
import { AnimationControls } from "./AnimationControls";
import {
  createRouteAnimationController,
  type AnimationPlaybackSnapshot,
  type RouteAnimationController,
} from "./animation-controller";
import { createRouteCameraController, type RouteCameraController } from "./camera-controller";
import { CompositionSettingsPanel } from "./CompositionSettingsPanel";
import {
  applyDaylight,
  applyMapAppearance,
  captureMapAppearanceState,
  PEAKS_LAYER_ID,
  resolveMapStyleUrl,
  ROUTE_CASING_WIDTHS,
  ROUTE_GLOW_WIDTH,
  ROUTE_LINE_WIDTHS,
  type MapAppearanceState,
} from "./map-appearance";
import { buildRaceClock, getDaylightAt } from "./route-clock";
import { observeMapSize, type MapResizeController } from "./map-resize-controller";
import { createNarrationPlayer, type NarrationClip, type NarrationPlayer } from "./narration-player";
import {
  buildLineProgressTable,
  getLineProgressAtDistance,
  getRoutePointAtDistance,
  prepareAnimationPath,
  type PreparedAnimationPath,
  type RouteRevealMode,
} from "./route-animation";
import {
  buildStoryBeats,
  detectRouteSlopes,
  getAutoDurationSeconds,
  getCumulativeGainAt,
  getSlopeId,
  MAX_VIDEO_SECONDS,
  type StoryBeat,
  type StoryLandmarks,
} from "./route-story";
import { StoryEditor, type AsyncActionState, type VoiceOptions } from "./StoryEditor";
import {
  buildElevationProfile,
  buildVideoTimeline,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  getGradeAtDistance,
  getVideoCameraPose,
  getVideoFrameState,
  type NarrationAlignments,
  type NarrationDurations,
  type ScheduledBeat,
  type VideoCompositionSettings,
} from "./video-composition";
import { createVideoFrameStore, VideoCompositionOverlay } from "./VideoCompositionOverlay";
import type { VideoGeneratorMapProps } from "./VideoGeneratorMap";

const TERRAIN_SOURCE_ID = "video-terrain-dem";
const ROUTE_SOURCE_ID = "video-route";
const ROUTE_LAYER_ID = "video-route-line";
const ROUTE_REVEAL_LAYER_ID = "video-route-line-reveal";
const ROUTE_GLOW_LAYER_ID = "video-route-line-glow";
const ROUTE_CASING_LAYER_ID = "video-route-line-casing";
const MARKER_SOURCE_ID = "video-route-markers";
const MARKER_CIRCLE_LAYER_ID = "video-route-marker-circles";
const MARKER_LABEL_LAYER_ID = "video-route-marker-labels";
// The climb, descent or rolling section being narrated, drawn in the highlight colour.
const SEGMENT_SOURCE_ID = "video-beat-segment";
const SEGMENT_LAYER_ID = "video-beat-segment-line";
const SEGMENT_DONE_LAYER_ID = "video-beat-segment-done";
// The told slope ahead of the runner is shown pale; behind the runner it is solid.
const SEGMENT_AHEAD_OPACITY = 0.4;
export const VIDEO_ROUTE_COLOR = DEFAULT_VIDEO_COMPOSITION_SETTINGS.routeColor;
const FUTURE_ROUTE_ALPHA_HEX = "38";
const GLOW_ROUTE_ALPHA_HEX = "8c";
const OWN_LAYER_IDS = new Set([
  ROUTE_LAYER_ID,
  ROUTE_GLOW_LAYER_ID,
  ROUTE_REVEAL_LAYER_ID,
  ROUTE_CASING_LAYER_ID,
  MARKER_CIRCLE_LAYER_ID,
  MARKER_LABEL_LAYER_ID,
  PEAKS_LAYER_ID,
  SEGMENT_LAYER_ID,
  SEGMENT_DONE_LAYER_ID,
]);

const EMPTY_FEATURES = { type: "FeatureCollection", features: [] } as const;
const IDLE_ACTION: AsyncActionState = { status: "idle", message: null };

const buildSegmentGeoJson = (path: PreparedAnimationPath, beat: ScheduledBeat | null) => {
  // The narrated slope itself (a whole climb, foot to top), not just the leg the story is on.
  if (!beat || beat.focusStartKm === undefined || beat.focusEndKm === undefined) return EMPTY_FEATURES;
  const { focusStartKm, focusEndKm } = beat;
  const coordinates = path.samples
    .filter((sample) => sample.distanceKm >= focusStartKm && sample.distanceKm <= focusEndKm)
    .map((sample) => [sample.lon, sample.lat]);
  if (coordinates.length < 2) return EMPTY_FEATURES;
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }],
  };
};

type TilequeryFeature = { properties?: { name?: unknown; maki?: unknown; elevation_m?: unknown } };

/** Highest named peak within 1.5 km of a point, from the Mapbox Streets natural labels. */
export const fetchNearestPeakName = async (lon: number, lat: number, token: string, signal?: AbortSignal) => {
  const url = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lon.toFixed(5)},${lat.toFixed(5)}.json`
    + `?radius=1500&limit=20&layers=natural_label&access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as { features?: TilequeryFeature[] } | null;
  const peaks = (payload?.features ?? [])
    .map((feature) => feature.properties ?? {})
    .filter((properties) => typeof properties.name === "string" && (properties.maki === "mountain" || properties.maki === "volcano"))
    .sort((left, right) => (Number(right.elevation_m) || 0) - (Number(left.elevation_m) || 0));
  return (peaks[0]?.name as string | undefined) ?? null;
};

type AidBubble = { distanceKm: number; card: HTMLElement; marker: mapboxgl.Marker; opacity: number };

const SVG_NS = "http://www.w3.org/2000/svg";
// Lucide-style outlines: a bottle for an aid station, a tent for a life base.
const STATION_ICON_PATHS = {
  aid: ["M10 2h4", "M10 2v3l-2 3v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8l-2-3V2", "M8 12h8"],
  lifeBase: ["M3.5 21 12 3l8.5 18", "M12 21l-4-7", "M12 21l4-7", "M2 21h20"],
} as const;

const createStationIcon = (kind: keyof typeof STATION_ICON_PATHS, color: string) => {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", color);
  svg.setAttribute("stroke-width", "2.4");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  Object.assign(svg.style, { width: "62%", height: "62%" });
  STATION_ICON_PATHS[kind].forEach((d) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  });
  return svg;
};

/**
 * Station marker: a small round icon sitting on the route (always visible) and, above it, a card
 * with the name, kilometre, cumulative D+ and cutoff that only shows while the runner approaches.
 * Mapbox owns the outer element (position, transform, opacity for occlusion), so every visual
 * style and the fading live on inner elements; the outer one only stacks them and sizes to fit.
 */
const createAidStationElement = (station: VideoAidStation, cumulativeGainM: number, accent: string) => {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  Object.assign(element.style, { display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" });

  const card = document.createElement("div");
  Object.assign(card.style, {
    position: "relative",
    marginBottom: "1.6cqmin",
    padding: "0.8cqmin 1.6cqmin",
    borderRadius: "1.2cqmin",
    background: "#ffffff",
    color: "#1a1a1a",
    borderLeft: `0.7cqmin solid ${accent}`,
    boxShadow: "0 0.4cqmin 1.6cqmin rgba(0, 0, 0, 0.35)",
    whiteSpace: "nowrap",
    width: "max-content",
    opacity: "0",
  });
  const line = (text: string, styles: Partial<CSSStyleDeclaration>) => {
    const node = document.createElement("div");
    node.textContent = text;
    Object.assign(node.style, styles);
    card.appendChild(node);
  };
  line(`${station.isLifeBase ? "Base de vie · " : ""}${station.name}`, { fontWeight: "800", fontSize: "2.4cqmin", lineHeight: "1.15" });
  const kilometre = station.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const gain = Math.round(cumulativeGainM).toLocaleString("fr-FR");
  line(`km ${kilometre} · D+ ${gain} m`, { fontWeight: "700", fontSize: "2cqmin", color: accent, fontVariantNumeric: "tabular-nums" });
  if (station.cutoffTime) line(`Barrière ${station.cutoffTime}`, { fontWeight: "600", fontSize: "1.9cqmin", color: "#5b5b5b" });
  const tail = document.createElement("span");
  Object.assign(tail.style, {
    position: "absolute",
    left: "50%",
    top: "100%",
    transform: "translateX(-50%)",
    borderLeft: "1cqmin solid transparent",
    borderRight: "1cqmin solid transparent",
    borderTop: "1.2cqmin solid #ffffff",
  });
  card.appendChild(tail);

  // Life bases are filled with the accent colour, aid stations are white: both read on any map.
  const pin = document.createElement("div");
  Object.assign(pin.style, {
    width: "4.2cqmin",
    height: "4.2cqmin",
    borderRadius: "9999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: station.isLifeBase ? accent : "#ffffff",
    border: `0.5cqmin solid ${station.isLifeBase ? "#ffffff" : accent}`,
    boxShadow: "0 0.3cqmin 1cqmin rgba(0, 0, 0, 0.35)",
    boxSizing: "border-box",
  });
  pin.appendChild(createStationIcon(station.isLifeBase ? "lifeBase" : "aid", station.isLifeBase ? "#ffffff" : accent));

  element.append(card, pin);
  return { element, card };
};

/**
 * A card fades in while the runner approaches its station (6 % of the route, 1.5 km minimum)
 * and fades out just after it; DOM writes only happen when the rounded opacity changes.
 */
const updateAidBubbles = (bubbles: AidBubble[], distanceKm: number | null, totalDistanceKm: number) => {
  const approachKm = Math.max(1.5, totalDistanceKm * 0.06);
  bubbles.forEach((bubble) => {
    let opacity = 0;
    if (distanceKm !== null) {
      const fadeIn = (distanceKm - (bubble.distanceKm - approachKm)) / (approachKm * 0.25);
      const fadeOut = (bubble.distanceKm + 0.6 - distanceKm) / 0.4;
      opacity = Math.max(0, Math.min(1, fadeIn, fadeOut));
    }
    const rounded = Math.round(opacity * 20) / 20;
    if (rounded !== bubble.opacity) {
      bubble.opacity = rounded;
      bubble.card.style.opacity = String(rounded);
    }
  });
};

const readError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null) as { message?: unknown } | null;
  return typeof payload?.message === "string" ? payload.message : fallback;
};

type GeoJsonSourceData = Parameters<GeoJSONSource["setData"]>[0];

const initialSnapshot: AnimationPlaybackSnapshot = {
  currentTimeMs: 0,
  durationMs: DEFAULT_VIDEO_COMPOSITION_SETTINGS.durationSeconds * 1_000,
  progress: 0,
  isPlaying: false,
};

const supportsWebGl = () => {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
};

// Trims the not-yet-run part of the bright reveal layer. Unlike a per-frame `line-gradient` update,
// changing `line-trim-offset` is a GPU uniform and does not rebuild the gradient texture of every tile.
export const buildRouteTrimOffset = (mode: RouteRevealMode, progress: number): [number, number] => {
  if (mode === "full") return [0, 0];
  const clamped = Math.min(1, Math.max(0, progress));
  return clamped >= 1 ? [0, 0] : [clamped, 1];
};

const buildMarkerRadius = (activeDistanceKm: number | null): ExpressionSpecification => [
  "case",
  ["==", ["get", "distanceKm"], activeDistanceKm ?? -1],
  12,
  ["match", ["get", "kind"], "aid", 6, 8],
];

// The runner: a white dot ringed in the route colour with a soft shadow.
const createProgressMarkerElement = (color: string) => {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  Object.assign(element.style, {
    width: "14px",
    height: "14px",
    borderRadius: "9999px",
    background: "#ffffff",
    border: `4px solid ${color}`,
    boxShadow: "0 0 0 2px #ffffff, 0 2px 8px rgba(0, 0, 0, 0.45)",
    boxSizing: "content-box",
  });
  return element;
};

const syncMapData = (
  map: MapboxMap,
  routeData: ReturnType<typeof buildRouteGeoJson>,
  markerData: ReturnType<typeof buildMarkerGeoJson>,
  settings: VideoCompositionSettings,
) => {
  const { routeColor } = settings;
  const lineWidth = ROUTE_LINE_WIDTHS[settings.routeWidth];
  const routeSource = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
  if (routeSource) routeSource.setData(routeData as GeoJsonSourceData);
  // tolerance 0: no simplification. Simplified tiles cut switchbacks short at low zoom, which made
  // the line progress (and the revealed trace) run ahead of the marker on winding climbs.
  else map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: routeData as GeoJsonSourceData, lineMetrics: true, tolerance: 0 });

  if (!map.getLayer(ROUTE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": `${routeColor}${FUTURE_ROUTE_ALPHA_HEX}`,
        "line-width": lineWidth,
        "line-emissive-strength": 1,
      },
    });
  }

  if (!map.getLayer(ROUTE_GLOW_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_GLOW_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round", visibility: settings.routeGlow ? "visible" : "none" },
      paint: {
        "line-color": `${routeColor}${GLOW_ROUTE_ALPHA_HEX}`,
        "line-width": ROUTE_GLOW_WIDTH,
        "line-blur": 8,
        "line-emissive-strength": 1,
        "line-trim-offset": buildRouteTrimOffset("progressive", 0),
      },
    });
  }

  // White casing under the revealed route, trimmed like it, for a clean branded line.
  if (!map.getLayer(ROUTE_CASING_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_CASING_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round", visibility: settings.routeCasing ? "visible" : "none" },
      paint: {
        "line-color": "#ffffff",
        "line-width": ROUTE_CASING_WIDTHS[settings.routeWidth],
        "line-emissive-strength": 1,
        "line-trim-offset": buildRouteTrimOffset("progressive", 0),
      },
    });
  }

  if (!map.getLayer(ROUTE_REVEAL_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_REVEAL_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": routeColor,
        "line-width": lineWidth,
        "line-opacity": 0.96,
        "line-emissive-strength": 1,
        "line-trim-offset": buildRouteTrimOffset("progressive", 0),
      },
    });
  }

  // The narrated slope is the route itself in the highlight colour, drawn over the reveal layer so
  // the whole climb shows even before the runner gets there.
  if (!map.getSource(SEGMENT_SOURCE_ID)) {
    map.addSource(SEGMENT_SOURCE_ID, { type: "geojson", data: EMPTY_FEATURES as unknown as GeoJsonSourceData, lineMetrics: true, tolerance: 0 });
  }
  if (!map.getLayer(SEGMENT_LAYER_ID)) {
    map.addLayer({
      id: SEGMENT_LAYER_ID,
      type: "line",
      source: SEGMENT_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": settings.highlightColor,
        "line-opacity": SEGMENT_AHEAD_OPACITY,
        "line-width": lineWidth,
        "line-emissive-strength": 1,
      },
    });
  }
  if (!map.getLayer(SEGMENT_DONE_LAYER_ID)) {
    map.addLayer({
      id: SEGMENT_DONE_LAYER_ID,
      type: "line",
      source: SEGMENT_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": settings.highlightColor,
        "line-width": lineWidth,
        "line-emissive-strength": 1,
        "line-trim-offset": [0, 1],
      },
    });
  }

  const markerSource = map.getSource(MARKER_SOURCE_ID) as GeoJSONSource | undefined;
  if (markerSource) markerSource.setData(markerData as GeoJsonSourceData);
  else map.addSource(MARKER_SOURCE_ID, { type: "geojson", data: markerData as GeoJsonSourceData });

  if (!map.getLayer(MARKER_CIRCLE_LAYER_ID)) {
    map.addLayer({
      id: MARKER_CIRCLE_LAYER_ID,
      type: "circle",
      source: MARKER_SOURCE_ID,
      slot: "top",
      paint: {
        "circle-radius": buildMarkerRadius(null),
        "circle-color": ["match", ["get", "kind"], "start", "#22c55e", "finish", "#e11d48", "#f59e0b"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }

  if (!map.getLayer(MARKER_LABEL_LAYER_ID)) {
    map.addLayer({
      id: MARKER_LABEL_LAYER_ID,
      type: "symbol",
      source: MARKER_SOURCE_ID,
      slot: "top",
      minzoom: 8,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 12,
        "text-offset": [0, 1.25],
        "text-anchor": "top",
        "text-allow-overlap": false,
      },
      paint: { "text-color": "#ffffff", "text-halo-color": "#172012", "text-halo-width": 1.5 },
    });
  }
};

const setMapInteractionsEnabled = (map: MapboxMap, enabled: boolean) => {
  const handlers = [map.boxZoom, map.doubleClickZoom, map.dragPan, map.dragRotate, map.keyboard, map.scrollZoom, map.touchZoomRotate];
  handlers.forEach((handler) => {
    if (enabled) handler.enable();
    else handler.disable();
  });
};

export function VideoGeneratorMapClient({ accessToken: sessionToken, aidStations, bounds, points, race }: VideoGeneratorMapProps) {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const cameraRef = useRef<RouteCameraController | null>(null);
  const animationRef = useRef<RouteAnimationController | null>(null);
  const resizeRef = useRef<MapResizeController | null>(null);
  const progressMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const activeBeatIdRef = useRef<string | null>(null);
  const aidBubblesRef = useRef<AidBubble[]>([]);
  const narrationPlayerRef = useRef<NarrationPlayer | null>(null);
  // `map.isStyleLoaded()` is false whenever a tile is loading or a source was just updated, which is
  // permanently the case while the camera flies. Gating frames on it skipped most of them.
  const layersReadyRef = useRef(false);
  const appearanceStateRef = useRef<MapAppearanceState>({ basemapSymbolLayerIds: [], hillshadeLayerIds: [] });
  // Last daylight applied to the map, quantized so the look only changes in small steps.
  const daylightKeyRef = useRef<string | null>(null);
  const styleUrlRef = useRef<string | null>(null);
  const activeAidDistanceRef = useRef<number | null>(null);
  const boundsRef = useRef(bounds);
  const pointsRef = useRef(points);

  const [settings, setSettings] = useState<VideoCompositionSettings>(DEFAULT_VIDEO_COMPOSITION_SETTINGS);
  const [preparedPath, setPreparedPath] = useState<PreparedAnimationPath>(() => prepareAnimationPath(points));
  const [mapError, setMapError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [snapshot, setSnapshot] = useState<AnimationPlaybackSnapshot>(initialSnapshot);
  const [webGlAvailable] = useState(() => typeof document === "undefined" || supportsWebGl());

  const enabledAidStations = useMemo(() => {
    const disabled = new Set(settings.disabledAidStationIds);
    return aidStations.filter((station) => !disabled.has(station.id));
  }, [aidStations, settings.disabledAidStationIds]);
  const routeData = useMemo(() => buildRouteGeoJson(points), [points]);
  const lineProgressTable = useMemo(() => buildLineProgressTable(points), [points]);
  // Start and finish only: aid stations are DOM icons placed exactly on the route (see below).
  const markerData = useMemo(() => buildMarkerGeoJson(points, []), [points]);

  // The story: detected moments with a default narration, overridden by the AI or by hand.
  const autoDurationSeconds = getAutoDurationSeconds(preparedPath.totalDistanceKm);
  const maxSeconds = settings.durationMode === "auto" ? MAX_VIDEO_SECONDS : settings.durationSeconds;
  const [landmarks, setLandmarks] = useState<StoryLandmarks>({});
  // Estimated passing time at each kilometre (classic pace, cutoffs) for the day/night look.
  const raceClock = useMemo(() => buildRaceClock(preparedPath, enabledAidStations, race), [enabledAidStations, preparedPath, race]);
  const activeClock = settings.dayNight ? raceClock : null;
  const daylightAt = useCallback(
    (distanceKm: number) => (activeClock ? getDaylightAt(activeClock, distanceKm) : null),
    [activeClock],
  );
  const defaultBeats = useMemo(() => buildStoryBeats(preparedPath, enabledAidStations, race, {
    maxSeconds,
    includeAidStations: settings.showAidStations,
    includeStart: settings.showStartInfo,
    landmarks,
    daylightAt,
  }), [daylightAt, enabledAidStations, landmarks, maxSeconds, preparedPath, race, settings.showAidStations, settings.showStartInfo]);

  // Summit names make the story concrete ("la montée vers le Mont Thou"): ask Mapbox for the
  // highest named peak near each climb top, once per route.
  useEffect(() => {
    if (!accessToken || !preparedPath.canAnimate) return;
    const controller = new AbortController();
    const climbs = detectRouteSlopes(preparedPath).filter((slope) => slope.kind === "climb").slice(0, 8);
    void Promise.all(climbs.map(async (climb) => {
      const top = getRoutePointAtDistance(preparedPath, climb.endKm);
      const name = await fetchNearestPeakName(top.lon, top.lat, accessToken, controller.signal);
      return name ? [getSlopeId(climb), name] as const : null;
    })).then((entries) => {
      if (!controller.signal.aborted) setLandmarks(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))));
    }).catch(() => undefined);
    return () => controller.abort();
  }, [accessToken, preparedPath]);
  const [narrationOverrides, setNarrationOverrides] = useState<Record<string, string>>({});
  const beats = useMemo<StoryBeat[]>(
    () => defaultBeats.map((beat) => narrationOverrides[beat.id] !== undefined ? { ...beat, narration: narrationOverrides[beat.id] } : beat),
    [defaultBeats, narrationOverrides],
  );
  const [voiceClips, setVoiceClips] = useState<Record<string, NarrationClip>>({});
  const [voiceId, setVoiceId] = useState("");
  const [voiceOptions, setVoiceOptions] = useState<VoiceOptions>({ model: "multilingual_v2", expressiveness: 0.6 });
  const [scriptState, setScriptState] = useState<AsyncActionState>(IDLE_ACTION);
  const [voiceState, setVoiceState] = useState<AsyncActionState>(IDLE_ACTION);
  // A clip only counts while its text still matches the narration it was generated from.
  const freshClips = useMemo(
    () => beats.flatMap((beat) => voiceClips[beat.id]?.text === beat.narration ? [voiceClips[beat.id]] : []),
    [beats, voiceClips],
  );
  const narrationAlignments = useMemo<NarrationAlignments>(
    () => Object.fromEntries(freshClips.flatMap((clip) => clip.characterEndMs ? [[clip.beatId, clip.characterEndMs]] : [])),
    [freshClips],
  );
  const narrationDurations = useMemo<NarrationDurations>(
    () => Object.fromEntries(freshClips.map((clip) => [clip.beatId, clip.durationMs])),
    [freshClips],
  );
  const timeline = useMemo(
    () => buildVideoTimeline(preparedPath, beats, settings, narrationDurations, raceClock, narrationAlignments),
    [beats, narrationAlignments, narrationDurations, preparedPath, raceClock, settings],
  );
  const profile = useMemo(() => buildElevationProfile(preparedPath), [preparedPath]);
  const [frameStore] = useState(() => createVideoFrameStore(getVideoFrameState(timeline, 0)));
  const elevationAtDistance = useCallback(
    (distanceKm: number) => getRoutePointAtDistance(preparedPath, distanceKm).elevationM,
    [preparedPath],
  );
  const gradeAtDistance = useCallback(
    (distanceKm: number) => getGradeAtDistance(preparedPath, distanceKm),
    [preparedPath],
  );

  const settingsRef = useRef(settings);
  const timelineRef = useRef(timeline);
  const preparedPathRef = useRef(preparedPath);
  const routeDataRef = useRef(routeData);
  const markerDataRef = useRef(markerData);
  settingsRef.current = settings;
  timelineRef.current = timeline;
  preparedPathRef.current = preparedPath;
  routeDataRef.current = routeData;
  const lineProgressTableRef = useRef(lineProgressTable);
  lineProgressTableRef.current = lineProgressTable;
  markerDataRef.current = markerData;

  const applyAnimationTime = useCallback((timeMs: number) => {
    const frame = getVideoFrameState(timelineRef.current, timeMs);
    frameStore.set(frame);
    const map = mapRef.current;
    const camera = cameraRef.current;
    const path = preparedPathRef.current;
    if (!map || !layersReadyRef.current || !camera || !path.canAnimate) return;

    camera.applyAnimationFrame(getVideoCameraPose(path, timelineRef.current, frame, settingsRef.current.viewport));
    const lineProgress = frame.routeProgress >= 1 ? 1 : getLineProgressAtDistance(lineProgressTableRef.current, frame.distanceKm);
    const trimOffset = buildRouteTrimOffset(settingsRef.current.revealMode, lineProgress);
    if (map.getLayer(ROUTE_REVEAL_LAYER_ID)) map.setPaintProperty(ROUTE_REVEAL_LAYER_ID, "line-trim-offset", trimOffset);
    if (map.getLayer(ROUTE_GLOW_LAYER_ID)) map.setPaintProperty(ROUTE_GLOW_LAYER_ID, "line-trim-offset", trimOffset);
    if (map.getLayer(ROUTE_CASING_LAYER_ID)) map.setPaintProperty(ROUTE_CASING_LAYER_ID, "line-trim-offset", trimOffset);
    const routePoint = getRoutePointAtDistance(path, frame.distanceKm);
    progressMarkerRef.current?.setLngLat([routePoint.lon, routePoint.lat]);
    updateAidBubbles(aidBubblesRef.current, frame.phase === "flyover" && settingsRef.current.showAidBubbles ? frame.distanceKm : null, path.totalDistanceKm);
    if (frame.daylight) {
      const { level, warmth, sunAzimuthDeg } = frame.daylight;
      const key = `${Math.round(level * 50)}|${Math.round(warmth * 20)}|${Math.round(sunAzimuthDeg / 10)}`;
      if (key !== daylightKeyRef.current) {
        daylightKeyRef.current = key;
        applyDaylight(map, settingsRef.current, frame.daylight, appearanceStateRef.current, OWN_LAYER_IDS);
      }
    } else if (daylightKeyRef.current !== null) {
      daylightKeyRef.current = null;
      applyMapAppearance(map, settingsRef.current, appearanceStateRef.current, OWN_LAYER_IDS);
    }

    // Beat changes are rare: only then the narrated segment and the station marker are updated.
    const beatId = frame.beat?.id ?? null;
    if (beatId !== activeBeatIdRef.current) {
      activeBeatIdRef.current = beatId;
      const segmentSource = map.getSource(SEGMENT_SOURCE_ID) as GeoJSONSource | undefined;
      segmentSource?.setData(buildSegmentGeoJson(path, frame.beat) as unknown as GeoJsonSourceData);
    }
    // Solid behind the runner, pale ahead: the told slope never looks revealed before the dot.
    if (frame.beat?.focusStartKm !== undefined && frame.beat.focusEndKm !== undefined && map.getLayer(SEGMENT_DONE_LAYER_ID)) {
      const table = lineProgressTableRef.current;
      const from = getLineProgressAtDistance(table, frame.beat.focusStartKm);
      const to = getLineProgressAtDistance(table, frame.beat.focusEndKm);
      const done = to > from ? (getLineProgressAtDistance(table, frame.distanceKm) - from) / (to - from) : 0;
      map.setPaintProperty(SEGMENT_DONE_LAYER_ID, "line-trim-offset", buildRouteTrimOffset("progressive", done));
    }
    const activeAidDistance = frame.beat && (frame.beat.kind === "aid" || frame.beat.kind === "lifeBase") ? frame.beat.anchorKm : null;
    if (activeAidDistance !== activeAidDistanceRef.current && map.getLayer(MARKER_CIRCLE_LAYER_ID)) {
      activeAidDistanceRef.current = activeAidDistance;
      map.setPaintProperty(MARKER_CIRCLE_LAYER_ID, "circle-radius", buildMarkerRadius(activeAidDistance));
    }
  }, [frameStore]);

  const refreshCurrentFrame = useCallback(() => {
    const controller = animationRef.current;
    if (controller) controller.seek(controller.getSnapshot().progress);
  }, []);

  useEffect(() => {
    boundsRef.current = bounds;
    pointsRef.current = points;
    setPreparedPath(prepareAnimationPath(points));
    animationRef.current?.pause();
    animationRef.current?.seek(0);
  }, [bounds, points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    syncMapData(map, routeData, markerData, settingsRef.current);
  }, [markerData, routeData]);

  useEffect(() => {
    animationRef.current?.setDuration(timeline.totalMs);
    refreshCurrentFrame();
  }, [refreshCurrentFrame, timeline]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      resizeRef.current?.schedule();
      refreshCurrentFrame();
    });
  }, [refreshCurrentFrame, settings.viewport]);

  useEffect(() => {
    refreshCurrentFrame();
  }, [refreshCurrentFrame, settings.revealMode, settings.showAidBubbles]);

  useEffect(() => {
    const map = mapRef.current;
    const markerElement = progressMarkerRef.current?.getElement();
    if (markerElement) markerElement.style.borderColor = settings.routeColor;
    if (!map || !layersReadyRef.current) return;
    const lineWidth = ROUTE_LINE_WIDTHS[settings.routeWidth];
    if (map.getLayer(ROUTE_REVEAL_LAYER_ID)) {
      map.setPaintProperty(ROUTE_REVEAL_LAYER_ID, "line-color", settings.routeColor);
      map.setPaintProperty(ROUTE_REVEAL_LAYER_ID, "line-width", lineWidth);
    }
    if (map.getLayer(ROUTE_LAYER_ID)) {
      map.setPaintProperty(ROUTE_LAYER_ID, "line-color", `${settings.routeColor}${FUTURE_ROUTE_ALPHA_HEX}`);
      map.setPaintProperty(ROUTE_LAYER_ID, "line-width", lineWidth);
    }
    [SEGMENT_LAYER_ID, SEGMENT_DONE_LAYER_ID].forEach((layerId) => {
      if (!map.getLayer(layerId)) return;
      map.setPaintProperty(layerId, "line-color", settings.highlightColor);
      map.setPaintProperty(layerId, "line-width", lineWidth);
    });
    if (map.getLayer(ROUTE_GLOW_LAYER_ID)) {
      map.setPaintProperty(ROUTE_GLOW_LAYER_ID, "line-color", `${settings.routeColor}${GLOW_ROUTE_ALPHA_HEX}`);
      map.setLayoutProperty(ROUTE_GLOW_LAYER_ID, "visibility", settings.routeGlow ? "visible" : "none");
    }
    if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
      map.setPaintProperty(ROUTE_CASING_LAYER_ID, "line-width", ROUTE_CASING_WIDTHS[settings.routeWidth]);
      map.setLayoutProperty(ROUTE_CASING_LAYER_ID, "visibility", settings.routeCasing ? "visible" : "none");
    }
  }, [settings.highlightColor, settings.routeCasing, settings.routeColor, settings.routeGlow, settings.routeWidth]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    applyMapAppearance(map, settingsRef.current, appearanceStateRef.current, OWN_LAYER_IDS);
    // The appearance reset the fog: let the next frame re-apply the daylight on top of it.
    daylightKeyRef.current = null;
    refreshCurrentFrame();
  }, [refreshCurrentFrame, settings.dayNight, settings.hideMapLabels, settings.mapAmbiance, settings.mapStyle, settings.showPeaks]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current || !map.getSource(TERRAIN_SOURCE_ID)) return;
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: settings.terrainExaggeration });
  }, [settings.terrainExaggeration]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) setMapInteractionsEnabled(map, !snapshot.isPlaying);
  }, [snapshot.isPlaying]);

  // Bubbles above aid stations: built once per route and settings, faded per frame.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;
    const bubbles = enabledAidStations
      .filter((station) => station.distanceKm > 0 && station.distanceKm < preparedPath.totalDistanceKm)
      .map((station): AidBubble => {
        const point = getRoutePointAtDistance(preparedPath, station.distanceKm);
        const { element, card } = createAidStationElement(station, getCumulativeGainAt(preparedPath, station.distanceKm), settings.accentColor);
        // Anchored at the bottom of the round icon, exactly on the route at the station kilometre.
        const marker = new mapboxgl.Marker({ element, anchor: "bottom", occludedOpacity: 1 })
          .setLngLat([point.lon, point.lat])
          .addTo(map);
        return { distanceKm: station.distanceKm, card, marker, opacity: -1 };
      });
    aidBubblesRef.current = bubbles;
    refreshCurrentFrame();
    return () => {
      bubbles.forEach((bubble) => bubble.marker.remove());
      aidBubblesRef.current = [];
    };
  }, [enabledAidStations, isReady, preparedPath, refreshCurrentFrame, settings.accentColor]);

  // Voice-over: clips are scheduled on the same timeline as the camera.
  const narrationCues = useMemo(
    () => timeline.beats.filter((beat) => narrationDurations[beat.id] !== undefined).map((beat) => ({ beatId: beat.id, startMs: beat.narrationStartMs })),
    [narrationDurations, timeline.beats],
  );
  const narrationCuesRef = useRef(narrationCues);
  narrationCuesRef.current = narrationCues;
  const isPlayingRef = useRef(false);
  isPlayingRef.current = snapshot.isPlaying;

  const restartNarration = useCallback(() => {
    const controller = animationRef.current;
    const player = narrationPlayerRef.current;
    if (!controller || !player) return;
    if (!isPlayingRef.current) {
      player.stop();
      return;
    }
    player.play(narrationCuesRef.current, controller.getSnapshot().currentTimeMs);
  }, []);

  useEffect(() => {
    const player = createNarrationPlayer();
    narrationPlayerRef.current = player;
    return () => {
      player.destroy();
      narrationPlayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    void narrationPlayerRef.current?.load(freshClips).then(restartNarration);
  }, [freshClips, restartNarration]);

  useEffect(() => {
    restartNarration();
  }, [narrationCues, restartNarration, snapshot.isPlaying]);

  const authorizedPost = (url: string, body: unknown) => fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const writeScript = async () => {
    setScriptState({ status: "loading", message: "Claude rédige la narration…" });
    try {
      const response = await authorizedPost("/api/admin/video-generator/script", {
        race: { title: race.title, subtitle: race.subtitle, distanceKm: race.distanceKm, elevationGainM: race.elevationGainM, startDetail: race.startDetail },
        targetSeconds: settings.durationMode === "auto" ? MAX_VIDEO_SECONDS : settings.durationSeconds,
        voiceModel: voiceOptions.model,
        beats: beats.map(({ id, kind, title, startKm, endKm, facts, services, cutoffTime, narration }) =>
          ({ id, kind, title, startKm, endKm, facts, services, cutoffTime, narration })),
      });
      if (!response.ok) throw new Error(await readError(response, "La narration n’a pas pu être rédigée."));
      const parsed = narrationScriptResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Le script reçu est invalide.");
      setNarrationOverrides((current) => ({ ...current, ...Object.fromEntries(parsed.data.beats.map((beat) => [beat.id, beat.narration])) }));
      setScriptState({ status: "success", message: "Narration rédigée. Relis-la puis génère la voix off." });
    } catch (error) {
      setScriptState({ status: "error", message: error instanceof Error ? error.message : "La narration n’a pas pu être rédigée." });
    }
  };

  const generateVoice = async () => {
    const items = beats.filter((beat) => beat.narration.trim()).map((beat) => ({ id: beat.id, text: beat.narration.trim() }));
    setVoiceState({ status: "loading", message: `Génération de ${items.length} phrases avec ElevenLabs…` });
    try {
      const response = await authorizedPost("/api/admin/video-generator/voice", { voiceId: voiceId || null, items, ...voiceOptions });
      if (!response.ok) throw new Error(await readError(response, "La voix off n’a pas pu être générée."));
      const parsed = narrationVoiceResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("L’audio reçu est invalide.");
      // The clip keeps the exact narration text so it stays valid only while that text is unchanged.
      const textById = new Map(beats.map((beat) => [beat.id, beat.narration]));
      setVoiceClips((current) => ({
        ...current,
        ...Object.fromEntries(parsed.data.clips.map((clip) => [clip.id, {
          beatId: clip.id,
          text: textById.get(clip.id) ?? clip.text,
          audioBase64: clip.audioBase64,
          durationMs: clip.durationMs,
          characterEndMs: clip.characterEndMs,
        }])),
      }));
      setVoiceState({ status: "success", message: "Voix off prête : lance la lecture." });
    } catch (error) {
      setVoiceState({ status: "error", message: error instanceof Error ? error.message : "La voix off n’a pas pu être générée." });
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) animationRef.current?.pause();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!accessToken || !webGlAvailable || !containerRef.current) return;
    mapboxgl.accessToken = accessToken;
    styleUrlRef.current = resolveMapStyleUrl(settingsRef.current);
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrlRef.current,
      center: [boundsRef.current.minLon, boundsRef.current.minLat],
      zoom: 9,
      pitch: 55,
      bearing: 0,
      projection: "mercator",
      antialias: true,
      // Mapbox terms require the logo and attribution. The logo stays on the map; the attribution is
      // burned into the overlay as legible text instead of the interactive "i" control.
      attributionControl: false,
      logoPosition: "bottom-right",
    });
    mapRef.current = map;
    cameraRef.current = createRouteCameraController(map, () => boundsRef.current);
    animationRef.current = createRouteAnimationController({
      durationMs: timelineRef.current.totalMs,
      onFrame: applyAnimationTime,
      onSnapshot: setSnapshot,
    });
    const resizeController = observeMapSize(map, containerRef.current);
    resizeRef.current = resizeController;
    const firstPoint = preparedPathRef.current.samples[0];
    progressMarkerRef.current = new mapboxgl.Marker({ element: createProgressMarkerElement(settingsRef.current.routeColor) })
      .setLngLat(firstPoint ? [firstPoint.lon, firstPoint.lat] : [boundsRef.current.minLon, boundsRef.current.minLat])
      .addTo(map);

    let styleLoadVersion = 0;
    const handleStyleLoad = () => {
      styleLoadVersion += 1;
      const loadVersion = styleLoadVersion;
      setMapError(null);
      if (!map.getSource(TERRAIN_SOURCE_ID)) {
        map.addSource(TERRAIN_SOURCE_ID, { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 });
      }
      map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: settingsRef.current.terrainExaggeration });
      syncMapData(map, routeDataRef.current, markerDataRef.current, settingsRef.current);
      appearanceStateRef.current = captureMapAppearanceState(map, OWN_LAYER_IDS);
      applyMapAppearance(map, settingsRef.current, appearanceStateRef.current, OWN_LAYER_IDS);
      activeAidDistanceRef.current = null;
      activeBeatIdRef.current = null;
      daylightKeyRef.current = null;
      layersReadyRef.current = true;
      resizeController.schedule();
      window.requestAnimationFrame(() => {
        if (mapRef.current !== map || loadVersion !== styleLoadVersion) return;
        cameraRef.current?.reset(0);
        map.once("idle", () => {
          if (mapRef.current !== map || loadVersion !== styleLoadVersion) return;
          setPreparedPath(prepareAnimationPath(pointsRef.current, ({ lat, lon }) =>
            map.queryTerrainElevation([lon, lat], { exaggerated: false })));
          setMapError(null);
          setIsReady(true);
        });
      });
    };
    const handleError = (event: MapboxEvent & { error?: Error & { status?: number }; sourceId?: string; tile?: unknown }) => {
      if (!event.error) return;
      console.error("Mapbox video generator error", event.error);
      // A single missing tile, sprite or glyph is not fatal and Mapbox keeps rendering. Only a
      // failure before the style is usable, or a rejected token, blocks the viewer.
      const isTileError = Boolean(event.sourceId || event.tile);
      const isAuthError = event.error.status === 401 || event.error.status === 403;
      if (isAuthError || (!isTileError && !layersReadyRef.current)) {
        setMapError(isAuthError
          ? "Le token Mapbox a été refusé. Vérifiez sa restriction de domaine."
          : "La carte 3D n’a pas pu être chargée. Vérifiez le token Mapbox ou l’URL du style.");
      }
    };

    map.on("style.load", handleStyleLoad);
    map.on("error", handleError);
    return () => {
      map.off("style.load", handleStyleLoad);
      map.off("error", handleError);
      animationRef.current?.destroy();
      progressMarkerRef.current?.remove();
      progressMarkerRef.current = null;
      layersReadyRef.current = false;
      resizeController.destroy();
      map.remove();
      mapRef.current = null;
      cameraRef.current = null;
      animationRef.current = null;
      resizeRef.current = null;
    };
  }, [accessToken, applyAnimationTime, webGlAvailable]);

  const updateSettings = (nextSettings: VideoCompositionSettings) => {
    const nextStyleUrl = resolveMapStyleUrl(nextSettings);
    if (nextStyleUrl !== styleUrlRef.current) {
      styleUrlRef.current = nextStyleUrl;
      animationRef.current?.pause();
      setIsReady(false);
      setMapError(null);
      layersReadyRef.current = false;
      mapRef.current?.setStyle(nextStyleUrl);
    }
    setSettings(nextSettings);
  };

  if (!accessToken) {
    return <div className="flex min-h-[34rem] w-full items-center justify-center bg-muted p-8 text-center text-sm text-muted-foreground">Configurez <code className="mx-1 rounded bg-background px-1.5 py-0.5">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> pour charger le terrain 3D.</div>;
  }
  if (!webGlAvailable) {
    return <div className="flex min-h-[34rem] w-full items-center justify-center bg-muted p-8 text-center text-sm text-muted-foreground">WebGL n’est pas disponible dans ce navigateur. Activez l’accélération graphique ou utilisez un navigateur compatible.</div>;
  }

  const portrait = settings.viewport === "portrait";
  const currentFrame = getVideoFrameState(timeline, snapshot.currentTimeMs);

  return (
    <>
      <section className="flex min-w-0 flex-col items-center gap-3" aria-label="Aperçu de la vidéo">
        {/* The frame always fits the viewport height so the whole preview is visible without scrolling. */}
        <div
          className={portrait
            ? "relative aspect-[9/16] h-[calc(100dvh-14rem)] max-h-[60rem] min-h-[26rem] max-w-full overflow-hidden rounded-[1.75rem] border-[6px] border-slate-900 bg-slate-950 shadow-2xl [container-type:size]"
            : "relative aspect-video max-h-[calc(100dvh-14rem)] w-full overflow-hidden rounded-xl border-[6px] border-slate-900 bg-slate-950 shadow-2xl [container-type:size]"}
          data-testid="video-preview-frame"
        >
          {/* Mapbox CSS sets `.mapboxgl-map { position: relative }`, which overrides `absolute` on the
              container itself. The wrapper owns positioning so the production canvas cannot collapse. */}
          <div className={`absolute inset-0 ${snapshot.isPlaying ? "pointer-events-none" : ""}`}>
            <div ref={containerRef} className="h-full w-full" aria-label="Visualiseur 3D animé du parcours" />
          </div>
          <VideoCompositionOverlay
            elevationAtDistance={elevationAtDistance}
            frameStore={frameStore}
            gradeAtDistance={gradeAtDistance}
            profile={profile}
            race={race}
            settings={settings}
          />
          {!isReady && !mapError ? <div className="pointer-events-none absolute inset-x-4 top-1/2 z-20 rounded-md bg-slate-950/80 p-3 text-center text-sm text-white/80">Préparation du terrain et de la caméra…</div> : null}
          {mapError ? <div className="absolute inset-x-4 top-1/2 z-20 rounded-md border border-red-300 bg-red-50/95 p-3 text-sm text-red-800 shadow-lg">{mapError}</div> : null}
        </div>
        <div className={portrait ? "w-full max-w-md" : "w-full"}>
          <AnimationControls
            canAnimate={preparedPath.canAnimate}
            currentDistanceKm={currentFrame.distanceKm}
            isReady={isReady}
            onPause={() => animationRef.current?.pause()}
            onPlay={() => animationRef.current?.play()}
            onRestart={() => {
              animationRef.current?.restart();
              restartNarration();
            }}
            onSeek={(progress) => {
              animationRef.current?.seek(progress);
              restartNarration();
            }}
            snapshot={snapshot}
            totalDistanceKm={preparedPath.totalDistanceKm}
          />
        </div>
      </section>

      <div className="h-fit space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Narration</CardTitle>
        </CardHeader>
        <CardContent>
          <StoryEditor
            beats={timeline.beats}
            narrationOverflow={timeline.narrationOverflow}
            onGenerateVoice={() => void generateVoice()}
            onNarrationChange={(beatId, narration) => setNarrationOverrides((current) => ({ ...current, [beatId]: narration }))}
            onResetScript={() => {
              setNarrationOverrides({});
              setScriptState(IDLE_ACTION);
            }}
            onVoiceIdChange={setVoiceId}
            onVoiceOptionsChange={setVoiceOptions}
            voiceOptions={voiceOptions}
            onWriteScript={() => void writeScript()}
            scriptState={scriptState}
            totalMs={timeline.totalMs}
            voiceId={voiceId}
            voiceReadyIds={new Set(Object.keys(narrationDurations))}
            voiceState={voiceState}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Composition vidéo</CardTitle>
        </CardHeader>
        <CardContent>
          <CompositionSettingsPanel
            autoDurationSeconds={autoDurationSeconds}
            dayNightAvailable={raceClock !== null}
            narratedIds={new Set(beats.map((beat) => beat.id))}
            aidStations={aidStations}
            cameraActionsDisabled={!isReady || snapshot.isPlaying}
            onChange={updateSettings}
            onFitOverview={() => cameraRef.current?.fitOverview()}
            onResetCamera={() => cameraRef.current?.reset()}
            settings={settings}
          />
        </CardContent>
      </Card>
      </div>
    </>
  );
}
