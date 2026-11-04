"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, {
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapboxEvent,
} from "mapbox-gl";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { buildRouteGeoJson, type VideoAidStation } from "../../../lib/video-generator";
import { instagramCaptionResponseSchema, narrationScriptResponseSchema, narrationVoiceResponseSchema } from "../../../lib/video-narration";
import { InstagramPanel } from "./InstagramPanel";
import { ExportPanel, type ExportState } from "./ExportPanel";
import { exportVideo } from "./video-export";
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
  SEGMENT_BORDER_WIDTHS,
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
  getFlyoverFractionAtDistance,
  getGradeAtDistance,
  getVideoCameraPose,
  getVideoFrameState,
  VIDEO_FPS,
  VIDEO_RESOLUTIONS,
  type NarrationAlignments,
  type NarrationDurations,
  type ScheduledBeat,
  type VideoCompositionSettings,
  type VideoFrameState,
  type VideoTimeline,
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
const MARKER_ICON_LAYER_ID = "video-route-marker-icons";
// The climb, descent or rolling section being narrated, drawn in the highlight colour.
const SEGMENT_SOURCE_ID = "video-beat-segment";
const SEGMENT_LAYER_ID = "video-beat-segment-line";
export const VIDEO_ROUTE_COLOR = DEFAULT_VIDEO_COMPOSITION_SETTINGS.routeColor;
const FUTURE_ROUTE_ALPHA_HEX = "38";
const GLOW_ROUTE_ALPHA_HEX = "8c";
const OWN_LAYER_IDS = new Set([
  ROUTE_LAYER_ID,
  ROUTE_GLOW_LAYER_ID,
  ROUTE_REVEAL_LAYER_ID,
  ROUTE_CASING_LAYER_ID,
  MARKER_ICON_LAYER_ID,
  PEAKS_LAYER_ID,
  SEGMENT_LAYER_ID,
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

type StationIconKind = "start" | "finish" | "aid" | "lifeBase";
const STATION_ICON_IDS: Record<StationIconKind, string> = {
  start: "video-icon-start",
  finish: "video-icon-finish",
  aid: "video-icon-aid",
  lifeBase: "video-icon-life-base",
};
// 24-unit outlines (Lucide style): a flag for the start, a chequered flag for the finish, a bottle
// for an aid station and a tent for a life base.
const STATION_ICON_PATHS: Record<StationIconKind, { stroke: string[]; fill?: string[] }> = {
  start: { stroke: ["M5 21V4", "M5 4h12l-2.5 4L17 12H5"] },
  finish: { stroke: ["M5 21V4", "M5 4h13v9H5"], fill: ["M5 4h3.25v3H5z", "M11.5 4h3.25v3H11.5z", "M8.25 7h3.25v3H8.25z", "M14.75 7H18v3h-3.25z", "M5 10h3.25v3H5z", "M11.5 10h3.25v3H11.5z"] },
  aid: { stroke: ["M10 2h4", "M10 2v3l-2 3v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8l-2-3V2", "M8 12h8"] },
  lifeBase: { stroke: ["M3.5 21 12 3l8.5 18", "M12 21l-4-7", "M12 21l4-7", "M2 21h20"] },
};
const ICON_PIXEL_RATIO = 2;
const ICON_SIZE = 32 * ICON_PIXEL_RATIO;

/** Round badge drawn on a canvas: filled disc, white or coloured ring, outline icon. */
const drawStationIcon = (kind: StationIconKind, accent: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const context = canvas.getContext("2d");
  if (!context || typeof context.arc !== "function" || typeof Path2D === "undefined") return null;
  const filled = kind !== "aid";
  const fill = kind === "finish" ? "#1a1a1a" : filled ? accent : "#ffffff";
  const ink = filled ? "#ffffff" : accent;
  const center = ICON_SIZE / 2;
  context.beginPath();
  context.arc(center, center, center - 4, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 6;
  context.strokeStyle = filled ? "#ffffff" : accent;
  context.stroke();
  const scale = (ICON_SIZE * 0.5) / 24;
  context.save();
  context.translate(center - 12 * scale, center - 12 * scale);
  context.scale(scale, scale);
  context.lineWidth = 2.4;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = ink;
  context.fillStyle = ink;
  STATION_ICON_PATHS[kind].stroke.forEach((d) => context.stroke(new Path2D(d)));
  STATION_ICON_PATHS[kind].fill?.forEach((d) => context.fill(new Path2D(d)));
  context.restore();
  return context.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
};

/** (Re)registers the station icons in the current style; styles drop their images on reload. */
const addStationIcons = (map: MapboxMap, accent: string) => {
  if (typeof map.addImage !== "function") return;
  (Object.keys(STATION_ICON_IDS) as StationIconKind[]).forEach((kind) => {
    const image = drawStationIcon(kind, accent);
    if (!image) return;
    const id = STATION_ICON_IDS[kind];
    if (map.hasImage?.(id)) map.removeImage(id);
    map.addImage(id, image, { pixelRatio: ICON_PIXEL_RATIO });
  });
};

/** Start, finish and stations at the exact route point of their kilometre. */
const buildStationIconGeoJson = (path: PreparedAnimationPath, stations: VideoAidStation[]) => {
  if (!path.canAnimate) return EMPTY_FEATURES;
  const feature = (distanceKm: number, kind: StationIconKind) => {
    const point = getRoutePointAtDistance(path, distanceKm);
    return {
      type: "Feature",
      properties: { kind, icon: STATION_ICON_IDS[kind], distanceKm },
      geometry: { type: "Point", coordinates: [point.lon, point.lat] },
    };
  };
  return {
    type: "FeatureCollection",
    features: [
      ...stations
        .filter((station) => station.distanceKm > 0 && station.distanceKm < path.totalDistanceKm)
        .map((station) => feature(station.distanceKm, station.isLifeBase ? "lifeBase" : "aid")),
      feature(0, "start"),
      feature(path.totalDistanceKm, "finish"),
    ],
  };
};

const CUTOFF_RED = "#d7263d";
const SVG_NS = "http://www.w3.org/2000/svg";

const createClockIcon = (color: string) => {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", color);
  svg.setAttribute("stroke-width", "2.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  Object.assign(svg.style, { width: "2.3cqmin", height: "2.3cqmin", flex: "none" });
  ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"].forEach((d) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  });
  return svg;
};

/**
 * Card shown above a station icon while the runner arrives: name, kilometre, cumulative D+ and
 * cutoff. Mapbox owns the marker element (position, transform, occlusion opacity), so all styles
 * and the fading live on the inner card, which sizes to its text.
 */
const createAidCardElement = (station: VideoAidStation, cumulativeGainM: number, accent: string) => {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  const card = document.createElement("div");
  Object.assign(card.style, {
    position: "relative",
    padding: "0.8cqmin 1.6cqmin",
    borderRadius: "1.2cqmin",
    background: "#ffffff",
    color: "#1a1a1a",
    borderLeft: `0.7cqmin solid ${accent}`,
    boxShadow: "0 0.4cqmin 1.6cqmin rgba(0, 0, 0, 0.35)",
    whiteSpace: "nowrap",
    width: "max-content",
    pointerEvents: "none",
    opacity: "0",
  });
  const line = (text: string, styles: Partial<CSSStyleDeclaration>) => {
    const node = document.createElement("div");
    node.textContent = text;
    Object.assign(node.style, styles);
    card.appendChild(node);
  };
  if (station.isLifeBase) {
    line("Base de vie", { display: "inline-block", marginBottom: "0.5cqmin", padding: "0.2cqmin 1cqmin", borderRadius: "9999px", background: accent, color: "#ffffff", fontWeight: "800", fontSize: "1.7cqmin", letterSpacing: "0.04em", textTransform: "uppercase" });
  }
  line(station.name, { fontWeight: "800", fontSize: "2.6cqmin", lineHeight: "1.15", color: accent, textTransform: "uppercase", letterSpacing: "0.02em" });
  const kilometre = station.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const gain = Math.round(cumulativeGainM).toLocaleString("fr-FR");
  line(`km ${kilometre} · D+ ${gain} m`, { fontWeight: "600", fontSize: "2.1cqmin", color: "#3f3f3f", fontVariantNumeric: "tabular-nums" });
  if (station.cutoffTime) {
    // Cutoff in red with a clock, so it stands out from the other figures.
    const cutoff = document.createElement("div");
    Object.assign(cutoff.style, { display: "flex", alignItems: "center", gap: "0.6cqmin", fontWeight: "700", fontSize: "2cqmin", color: CUTOFF_RED });
    cutoff.append(createClockIcon(CUTOFF_RED), document.createTextNode(`Barrière ${station.cutoffTime}`));
    card.appendChild(cutoff);
  }
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
  element.appendChild(card);
  return { element, card };
};

// A card shows from 3.5 s before the runner reaches its station to 1.5 s after, with short fades:
// tied to video time, so it behaves the same whatever the speed of the flyover there.
const CARD_LEAD_MS = 3_500;
const CARD_TRAIL_MS = 1_500;
const CARD_FADE_MS = 400;

const updateAidBubbles = (bubbles: AidBubble[], timeline: VideoTimeline, timeMs: number | null) => {
  bubbles.forEach((bubble) => {
    let opacity = 0;
    if (timeMs !== null) {
      const arrivalMs = timeline.introMs + getFlyoverFractionAtDistance(timeline, bubble.distanceKm) * timeline.flyoverMs;
      const fadeIn = (timeMs - (arrivalMs - CARD_LEAD_MS)) / CARD_FADE_MS;
      const fadeOut = (arrivalMs + CARD_TRAIL_MS - timeMs) / CARD_FADE_MS;
      opacity = Math.max(0, Math.min(1, fadeIn, fadeOut));
    }
    const rounded = Math.round(opacity * 20) / 20;
    if (rounded !== bubble.opacity) {
      bubble.opacity = rounded;
      bubble.card.style.opacity = String(rounded);
    }
  });
};

type ClimbCard = { card: HTMLElement; title: HTMLElement; facts: HTMLElement; marker: mapboxgl.Marker; beatId: string | null; opacity: number };

/** One card reused for every told slope, placed in the middle of it: title and key figures. */
// Brand green card with an orange edge (the highlight colour), white text.
const createClimbCard = (map: MapboxMap, accent: string, highlight: string): ClimbCard => {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  const card = document.createElement("div");
  Object.assign(card.style, {
    position: "relative",
    padding: "0.8cqmin 1.6cqmin",
    borderRadius: "1.2cqmin",
    background: accent,
    borderLeft: `0.8cqmin solid ${highlight}`,
    color: "#ffffff",
    boxShadow: "0 0.4cqmin 1.6cqmin rgba(0, 0, 0, 0.35)",
    whiteSpace: "nowrap",
    width: "max-content",
    pointerEvents: "none",
    opacity: "0",
  });
  const title = document.createElement("div");
  Object.assign(title.style, { fontWeight: "800", fontSize: "2.8cqmin", lineHeight: "1.15", textTransform: "uppercase", letterSpacing: "0.02em" });
  const facts = document.createElement("div");
  Object.assign(facts.style, { fontWeight: "600", fontSize: "2.3cqmin", marginTop: "0.3cqmin", color: highlight, fontVariantNumeric: "tabular-nums" });
  const tail = document.createElement("span");
  Object.assign(tail.style, {
    position: "absolute",
    left: "50%",
    top: "100%",
    transform: "translateX(-50%)",
    borderLeft: "1cqmin solid transparent",
    borderRight: "1cqmin solid transparent",
    borderTop: `1.2cqmin solid ${accent}`,
  });
  card.append(title, facts, tail);
  element.appendChild(card);
  const marker = new mapboxgl.Marker({ element, anchor: "bottom", offset: [0, -6], occludedOpacity: 1 }).setLngLat([0, 0]).addTo(map);
  return { card, title, facts, marker, beatId: null, opacity: -1 };
};

/**
 * Shown while the voice tells the slope and the runner has not reached its top yet, with short
 * fades; content and position only change when the told slope changes.
 */
const updateClimbCard = (climbCard: ClimbCard, path: PreparedAnimationPath, timeline: VideoTimeline, frame: VideoFrameState) => {
  const beat = frame.phase === "flyover" ? frame.beat : null;
  let opacity = 0;
  if (beat?.focusTitle && beat.focusStartKm !== undefined && beat.focusEndKm !== undefined) {
    if (beat.id !== climbCard.beatId) {
      climbCard.beatId = beat.id;
      climbCard.title.textContent = beat.focusTitle;
      climbCard.facts.textContent = (beat.focusFacts ?? []).join(" · ");
      const middle = getRoutePointAtDistance(path, (beat.focusStartKm + beat.focusEndKm) / 2);
      climbCard.marker.setLngLat([middle.lon, middle.lat]);
    }
    const topMs = timeline.introMs + getFlyoverFractionAtDistance(timeline, beat.focusEndKm) * timeline.flyoverMs;
    const endMs = Math.min(beat.narrationStartMs + beat.narrationMs + 1_000, topMs);
    opacity = Math.max(0, Math.min(1, (frame.timeMs - beat.narrationStartMs) / CARD_FADE_MS, (endMs - frame.timeMs) / CARD_FADE_MS));
  }
  const rounded = Math.round(opacity * 20) / 20;
  if (rounded !== climbCard.opacity) {
    climbCard.opacity = rounded;
    climbCard.card.style.opacity = String(rounded);
  }
};

const waitMs = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

/** Resolves once the map has drawn the current camera with its tiles loaded, or after a timeout. */
const waitForMapIdle = (map: MapboxMap, timeoutMs: number) => new Promise<void>((resolve) => {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    map.off("idle", finish);
    resolve();
  };
  const timer = window.setTimeout(finish, timeoutMs);
  map.once("idle", finish);
  map.triggerRepaint();
});

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
  markerData: unknown,
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

  // The narrated slope gets an orange border: a wider line in the highlight colour drawn under
  // every route layer, so only its edges show around the green route and its white casing.
  if (!map.getSource(SEGMENT_SOURCE_ID)) {
    map.addSource(SEGMENT_SOURCE_ID, { type: "geojson", data: EMPTY_FEATURES as unknown as GeoJsonSourceData, tolerance: 0 });
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
        "line-width": SEGMENT_BORDER_WIDTHS[settings.routeWidth],
        "line-emissive-strength": 1,
      },
    }, map.getLayer(ROUTE_LAYER_ID) ? ROUTE_LAYER_ID : undefined);
  }

  const markerSource = map.getSource(MARKER_SOURCE_ID) as GeoJSONSource | undefined;
  if (markerSource) markerSource.setData(markerData as GeoJsonSourceData);
  else map.addSource(MARKER_SOURCE_ID, { type: "geojson", data: markerData as GeoJsonSourceData });

  if (!map.getLayer(MARKER_ICON_LAYER_ID)) {
    // Drawn by the map itself, so the icons sit on the route at terrain level and move with it.
    map.addLayer({
      id: MARKER_ICON_LAYER_ID,
      type: "symbol",
      source: MARKER_SOURCE_ID,
      slot: "top",
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 13, 0.9],
        "icon-anchor": "center",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-pitch-alignment": "viewport",
        "icon-rotation-alignment": "viewport",
      },
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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const [exportLayout, setExportLayout] = useState<{ width: number; height: number; scale: number } | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });
  const mapRef = useRef<MapboxMap | null>(null);
  const cameraRef = useRef<RouteCameraController | null>(null);
  const animationRef = useRef<RouteAnimationController | null>(null);
  const resizeRef = useRef<MapResizeController | null>(null);
  const progressMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const activeBeatIdRef = useRef<string | null>(null);
  const aidBubblesRef = useRef<AidBubble[]>([]);
  const climbCardRef = useRef<ClimbCard | null>(null);
  const narrationPlayerRef = useRef<NarrationPlayer | null>(null);
  // `map.isStyleLoaded()` is false whenever a tile is loading or a source was just updated, which is
  // permanently the case while the camera flies. Gating frames on it skipped most of them.
  const layersReadyRef = useRef(false);
  const appearanceStateRef = useRef<MapAppearanceState>({ basemapSymbolLayerIds: [], hillshadeLayerIds: [] });
  // Last daylight applied to the map, quantized so the look only changes in small steps.
  const daylightKeyRef = useRef<string | null>(null);
  const styleUrlRef = useRef<string | null>(null);
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
  // Start, finish and station icons at the exact route point of their kilometre.
  const markerData = useMemo(() => buildStationIconGeoJson(preparedPath, enabledAidStations), [enabledAidStations, preparedPath]);

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
  const [instagramCaption, setInstagramCaption] = useState("");
  const [instagramHashtags, setInstagramHashtags] = useState<string[]>([]);
  const [instagramState, setInstagramState] = useState<AsyncActionState>(IDLE_ACTION);
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
    updateAidBubbles(aidBubblesRef.current, timelineRef.current, frame.phase === "flyover" && settingsRef.current.showAidBubbles ? frame.timeMs : null);
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

    // Beat changes are rare: only then the narrated segment is updated. Once the runner is past the
    // told slope, its colour is removed even if the leg goes on.
    const passedFocus = frame.beat?.focusEndKm !== undefined && frame.distanceKm > frame.beat.focusEndKm + 0.05;
    const segmentKey = frame.beat && !passedFocus ? frame.beat.id : null;
    if (segmentKey !== activeBeatIdRef.current) {
      activeBeatIdRef.current = segmentKey;
      const segmentSource = map.getSource(SEGMENT_SOURCE_ID) as GeoJSONSource | undefined;
      segmentSource?.setData(buildSegmentGeoJson(path, passedFocus ? null : frame.beat) as unknown as GeoJsonSourceData);
    }
    if (climbCardRef.current) updateClimbCard(climbCardRef.current, path, timelineRef.current, frame);
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
    if (map.getLayer(SEGMENT_LAYER_ID)) {
      map.setPaintProperty(SEGMENT_LAYER_ID, "line-color", settings.highlightColor);
      map.setPaintProperty(SEGMENT_LAYER_ID, "line-width", SEGMENT_BORDER_WIDTHS[settings.routeWidth]);
    }
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
        const { element, card } = createAidCardElement(station, getCumulativeGainAt(preparedPath, station.distanceKm), settings.accentColor);
        // The card tail points at the station icon drawn by the map (about 15 px radius).
        const marker = new mapboxgl.Marker({ element, anchor: "bottom", offset: [0, -18], occludedOpacity: 1 })
          .setLngLat([point.lon, point.lat])
          .addTo(map);
        return { distanceKm: station.distanceKm, card, marker, opacity: -1 };
      });
    aidBubblesRef.current = bubbles;
    const climbCard = createClimbCard(map, settings.accentColor, settings.highlightColor);
    climbCardRef.current = climbCard;
    refreshCurrentFrame();
    return () => {
      bubbles.forEach((bubble) => bubble.marker.remove());
      aidBubblesRef.current = [];
      climbCard.marker.remove();
      climbCardRef.current = null;
    };
  }, [enabledAidStations, isReady, preparedPath, refreshCurrentFrame, settings.accentColor, settings.highlightColor]);

  // Station icons are images in the style: redraw them when the accent colour changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    addStationIcons(map, settings.accentColor);
    map.triggerRepaint();
  }, [settings.accentColor]);

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

  // MP4 export: the preview frame is laid out at the exact video size (scaled down on screen),
  // then every frame is rendered, waited for and captured.
  const startExport = async () => {
    const map = mapRef.current;
    if (!map || !isReady || exportAbortRef.current) return;
    animationRef.current?.pause();
    narrationPlayerRef.current?.stop();
    const base = VIDEO_RESOLUTIONS[settings.resolution];
    const size = settings.viewport === "portrait" ? base : { width: base.height, height: base.width };
    const scale = Math.min(1, Math.max(0.15, (window.innerHeight - 224) / size.height));
    if (exportState.status === "done") URL.revokeObjectURL(exportState.url);
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportState({ status: "running" });
    setExportLayout({ ...size, scale });
    let lastProgressAt = 0;
    try {
      await waitMs(80);
      // One CSS pixel per video pixel; on a high-density screen the map canvas is larger and is
      // scaled down to the video size when composited.
      map.resize();
      await waitForMapIdle(map, 10_000);
      const blob = await exportVideo({
        width: size.width,
        height: size.height,
        fps: VIDEO_FPS,
        totalMs: timelineRef.current.totalMs,
        driver: {
          renderFrame: async (timeMs) => {
            applyAnimationTime(timeMs);
            // Let React paint the overlay for this frame, then wait for the map tiles.
            await waitMs(0);
            await waitForMapIdle(map, 6_000);
          },
          mapCanvas: () => map.getCanvas(),
          frameElement: () => {
            if (!frameRef.current) throw new Error("Aperçu introuvable.");
            return frameRef.current;
          },
        },
        narration: freshClips.length ? { clips: freshClips, cues: narrationCuesRef.current } : null,
        onProgress: (progress) => {
          const now = performance.now();
          if (progress.phase === "rendering" && progress.frame < progress.totalFrames && now - lastProgressAt < 250) return;
          lastProgressAt = now;
          setExportState({ status: "running", progress });
        },
        signal: controller.signal,
      });
      const fileName = `${race.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "parcours"}-reel.mp4`;
      setExportState({ status: "done", url: URL.createObjectURL(blob), sizeBytes: blob.size, fileName });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setExportState({ status: "idle", message: "Export annulé." });
      else setExportState({ status: "error", message: error instanceof Error ? error.message : "L’export a échoué." });
    } finally {
      exportAbortRef.current = null;
      setExportLayout(null);
      window.requestAnimationFrame(() => {
        map.resize();
        refreshCurrentFrame();
      });
    }
  };

  const writeInstagramCaption = async () => {
    setInstagramState({ status: "loading", message: "Claude rédige la description du reel…" });
    try {
      const response = await authorizedPost("/api/admin/video-generator/caption", {
        race: {
          title: race.title, subtitle: race.subtitle, distanceKm: race.distanceKm, elevationGainM: race.elevationGainM,
          startDetail: race.startDetail, raceDate: race.raceDate ?? null,
        },
        legs: beats.map(({ kind, title, facts, narration }) => ({ kind, title, facts, narration })),
      });
      if (!response.ok) throw new Error(await readError(response, "La description n’a pas pu être rédigée."));
      const parsed = instagramCaptionResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("La description reçue est invalide.");
      setInstagramCaption(parsed.data.caption);
      setInstagramHashtags(parsed.data.hashtags);
      setInstagramState({ status: "success", message: "Description prête : relis-la puis copie-la dans Instagram." });
    } catch (error) {
      setInstagramState({ status: "error", message: error instanceof Error ? error.message : "La description n’a pas pu être rédigée." });
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
      // Needed to read the map canvas after it has been drawn (MP4 export).
      preserveDrawingBuffer: true,
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
      addStationIcons(map, settingsRef.current.accentColor);
      syncMapData(map, routeDataRef.current, markerDataRef.current, settingsRef.current);
      appearanceStateRef.current = captureMapAppearanceState(map, OWN_LAYER_IDS);
      applyMapAppearance(map, settingsRef.current, appearanceStateRef.current, OWN_LAYER_IDS);
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
      <section className="flex min-w-0 flex-col items-start gap-3" aria-label="Aperçu de la vidéo">
        {/* The frame always fits the viewport height so the whole preview is visible without scrolling.
            While exporting, it is laid out at the exact video size and only scaled down on screen by
            the wrappers, so the captured frame is neither scaled nor framed like a phone. */}
        <div
          className={exportLayout ? "overflow-hidden rounded-lg shadow-2xl" : "contents"}
          style={exportLayout ? { width: exportLayout.width * exportLayout.scale, height: exportLayout.height * exportLayout.scale } : undefined}
        >
        <div
          className={exportLayout ? "origin-top-left" : "contents"}
          style={exportLayout ? { transform: `scale(${exportLayout.scale})` } : undefined}
        >
        <div
          ref={frameRef}
          className={exportLayout
            ? "relative overflow-hidden bg-transparent [container-type:size]"
            : portrait
              ? "relative aspect-[9/16] h-[calc(100dvh-14rem)] max-h-[60rem] min-h-[26rem] max-w-full overflow-hidden rounded-[1.75rem] border-[6px] border-slate-900 bg-slate-950 shadow-2xl [container-type:size]"
              : "relative aspect-video h-[calc((100dvh-14rem)*0.6)] min-h-[16rem] max-w-[calc(100vw-48rem)] overflow-hidden rounded-xl border-[6px] border-slate-900 bg-slate-950 shadow-2xl [container-type:size]"}
          style={exportLayout ? { width: exportLayout.width, height: exportLayout.height } : undefined}
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
        </div>
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
          <CardTitle className="text-base">Export vidéo</CardTitle>
        </CardHeader>
        <CardContent>
          <ExportPanel
            canExport={isReady && preparedPath.canAnimate}
            hasVoice={freshClips.length > 0}
            onCancel={() => exportAbortRef.current?.abort()}
            onExport={() => void startExport()}
            resolutionLabel={settings.resolution}
            state={exportState}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Publication Instagram</CardTitle>
        </CardHeader>
        <CardContent>
          <InstagramPanel
            caption={instagramCaption}
            hashtags={instagramHashtags}
            onCaptionChange={setInstagramCaption}
            onGenerate={() => void writeInstagramCaption()}
            onHashtagsChange={setInstagramHashtags}
            state={instagramState}
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
