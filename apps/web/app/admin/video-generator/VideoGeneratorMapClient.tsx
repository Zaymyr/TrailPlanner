"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, {
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapboxEvent,
} from "mapbox-gl";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { buildRouteGeoJson, type VideoAidStation } from "../../../lib/video-generator";
import {
  assembleReelContent,
  buildNarrationOverrides,
  reelContentResponseSchema,
  type ReelContent,
  type ReelContentWarning,
} from "../../../lib/reel-content";
import { savedNarrationResponseSchema } from "../../../lib/video-narrations";
import { instagramCaptionResponseSchema, NARRATION_STYLE_LABELS, narrationScriptResponseSchema, narrationVoiceResponseSchema } from "../../../lib/video-narration";
import { InstagramPanel } from "./InstagramPanel";
import { ExportPanel, type ExportState } from "./ExportPanel";
import { getExportFrame, overrideDevicePixelRatio } from "./export-frame";
import { loadReelMusicManifest, resolveMusicTrack, EMPTY_REEL_MUSIC_MANIFEST, type ReelMusicManifest } from "./reel-music";
import { exportVideo, type SoundtrackReport } from "./video-export";
import { AnimationControls } from "./AnimationControls";
import {
  createRouteAnimationController,
  type AnimationPlaybackSnapshot,
  type RouteAnimationController,
} from "./animation-controller";
import { createRouteCameraController, type RouteCameraController } from "./camera-controller";
import { CompositionSettingsPanel, DurationSelect } from "./CompositionSettingsPanel";
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
  type StoryBeat,
  type StoryLandmarks,
} from "./route-story";
import { StoryEditor, type AsyncActionState, type ScriptStyleChoice, type VoiceOptions } from "./StoryEditor";
import { buildHighlightBeats, selectHighlights } from "./highlights";
import {
  buildToldSlopeGeoJson,
  getToldSlope,
  buildElevationProfile,
  buildVideoTimeline,
  CUTOFF_RED,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  isCompactOverlayEnabled,
  OVERLAY_FONT_CQMIN,
  getFlyoverFractionAtDistance,
  HIGHLIGHT_MAX_SECONDS,
  HIGHLIGHT_MIN_SECONDS,
  HIGHLIGHT_TARGET_SECONDS,
  INITIAL_EDITOR_SETTINGS,
  withStoryMode,
  getGradeAtDistance,
  getLegPassages,
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
  videoCompositionSettingsSchema,
} from "./video-composition";
import { createVideoFrameStore, VideoCompositionOverlay } from "./VideoCompositionOverlay";
import type { VideoGeneratorMapProps } from "./VideoGeneratorMap";
import type { VideoRenderSnapshot } from "./render-snapshot";
import { BackgroundRenderPanel } from "./BackgroundRenderPanel";
import { launchBackgroundRender } from "./background-render";
import { ReelPipelinePanel } from "./ReelPipelinePanel";
import { waitUntil, type ReelPipelineRunners } from "./reel-pipeline";
import { useReelPipeline } from "./useReelPipeline";
import {
  forgetVoice,
  getLastUsedVoiceId,
  loadVoiceLibrary,
  nameVoice,
  rememberVoice,
  storeVoiceLibrary,
  type SavedVoice,
} from "./voice-library";
import { getSpeechRateKey, loadSpeechRates, measureWordsPerSecond, storeSpeechRates } from "./speech-rate";
import {
  buildRaceFigures,
  formatElevationM,
  formatKm,
  getAnnouncedElevationGainM,
  roundKm,
  roundTotalKm,
  toAnnouncedElevationM,
  toAnnouncedKm,
  toRouteAidStations,
  type RaceFigures,
} from "./race-figures";
import { pickShockFigure } from "./reel-hook";
import { loadScriptNotes, storeScriptNotes } from "./script-notes";
import { fetchNearestPlaceName, resolveEndpointNames, type EndpointNames } from "./place-labels";
import { getEndpointLabelSpecs, getPinnedLabelBox, resolveLabelVisibility, type LabelCandidate, type LabelKind } from "./label-layout";

const TERRAIN_SOURCE_ID = "video-terrain-dem";
const ROUTE_SOURCE_ID = "video-route";
const ROUTE_LAYER_ID = "video-route-line";
const ROUTE_REVEAL_LAYER_ID = "video-route-line-reveal";
const ROUTE_GLOW_LAYER_ID = "video-route-line-glow";
const ROUTE_CASING_LAYER_ID = "video-route-line-casing";
const MARKER_SOURCE_ID = "video-route-markers";
const MARKER_ICON_LAYER_ID = "video-route-marker-icons";
// The climb or descent being told, in the profile slope colours over a white casing.
const TOLD_SLOPE_SOURCE_ID = "video-told-slope";
const TOLD_SLOPE_LAYER_ID = "video-told-slope-line";
const TOLD_SLOPE_CASING_LAYER_ID = "video-told-slope-casing";
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
  TOLD_SLOPE_LAYER_ID,
  TOLD_SLOPE_CASING_LAYER_ID,
]);

const EMPTY_FEATURES = { type: "FeatureCollection", features: [] } as const;
const IDLE_ACTION: AsyncActionState = { status: "idle", message: null };


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

/** A label card pinned above a route point; `hidden` is the verdict of the label layout. */
type PinnedLabel = { id: string; kind: LabelKind; card: HTMLElement; marker: mapboxgl.Marker; lon: number; lat: number; elevationM: number; offsetY: number; tailCqmin: number; hidden: boolean };
type AidBubble = PinnedLabel & { distanceKm: number; opacity: number };

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

const SVG_NS = "http://www.w3.org/2000/svg";

const createClockIcon = (color: string) => {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", color);
  svg.setAttribute("stroke-width", "2.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  Object.assign(svg.style, { width: "1em", height: "1em", flex: "none" });
  ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"].forEach((d) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  });
  return svg;
};

/**
 * Marker element of zero size whose card is centred above the anchor point by layout (flex), not
 * by Mapbox's `translate(-50%, -100%)` anchor. That translate is resolved in pixels from the live
 * card width; the export rasterises a clone with its own embedded fonts, whose text can be wider
 * or narrower, which slid the bubbles sideways off their station in rendered videos. Used with
 * the "center" anchor, which is a no-op on a zero-size element.
 */
const createPinnedMarkerElement = () => {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  Object.assign(element.style, {
    width: "0",
    height: "0",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
    overflow: "visible",
  });
  return element;
};

/**
 * Card shown above a station icon while the runner arrives: name, kilometre, cumulative D+ and
 * cutoff. The light overlay keeps the name only, larger; its figures are in the leg card.
 * Mapbox owns the marker element (position, transform, occlusion opacity), so all styles
 * and the fading live on the inner card, which sizes to its text.
 */
const createAidCardElement = (station: VideoAidStation, cumulativeGainM: number, accent: string, figures: RaceFigures, compact: boolean) => {
  const element = createPinnedMarkerElement();
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
    flex: "none",
    pointerEvents: "none",
    opacity: "0",
  });
  const line = (text: string, styles: Partial<CSSStyleDeclaration>) => {
    const node = document.createElement("div");
    node.textContent = text;
    Object.assign(node.style, styles);
    card.appendChild(node);
  };
  if (station.isLifeBase && !compact) {
    line("Base de vie", { display: "inline-block", marginBottom: "0.5cqmin", padding: "0.2cqmin 1cqmin", borderRadius: "9999px", background: accent, color: "#ffffff", fontWeight: "800", fontSize: `${OVERLAY_FONT_CQMIN.aidLifeBase}cqmin`, letterSpacing: "0.04em", textTransform: "uppercase" });
  }
  const nameFont = compact ? OVERLAY_FONT_CQMIN.aidNameCompact : OVERLAY_FONT_CQMIN.aidName;
  line(station.name, { fontWeight: "800", fontSize: `${nameFont}cqmin`, lineHeight: "1.15", color: accent, textTransform: "uppercase", letterSpacing: "0.02em" });
  if (!compact) {
    // Station in route kilometres, GPX D+: both shown in the announced scale.
    const kilometre = formatKm(toAnnouncedKm(figures, station.distanceKm));
    const gain = formatElevationM(toAnnouncedElevationM(figures, cumulativeGainM));
    line(`km ${kilometre} · D+ ${gain} m`, { fontWeight: "600", fontSize: `${OVERLAY_FONT_CQMIN.aidDetail}cqmin`, color: "#3f3f3f", fontVariantNumeric: "tabular-nums" });
  }
  if (station.cutoffTime && !compact) {
    // Cutoff in red with a clock, so it stands out from the other figures.
    const cutoff = document.createElement("div");
    Object.assign(cutoff.style, { display: "flex", alignItems: "center", gap: "0.6cqmin", fontWeight: "700", fontSize: `${OVERLAY_FONT_CQMIN.aidDetail}cqmin`, color: CUTOFF_RED });
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

/** Small white pill with the accent edge, like the aid bubbles: "DÉPART" over the place name. */
const createPlaceLabelElement = (kind: string, name: string, accent: string) => {
  const element = createPinnedMarkerElement();
  const card = document.createElement("div");
  Object.assign(card.style, {
    padding: "0.6cqmin 1.4cqmin",
    borderRadius: "1.2cqmin",
    background: "#ffffff",
    borderLeft: `0.7cqmin solid ${accent}`,
    boxShadow: "0 0.4cqmin 1.6cqmin rgba(0, 0, 0, 0.35)",
    whiteSpace: "nowrap",
    width: "max-content",
    flex: "none",
    pointerEvents: "none",
  });
  const kindLine = document.createElement("div");
  kindLine.textContent = kind;
  Object.assign(kindLine.style, { fontWeight: "800", fontSize: `${OVERLAY_FONT_CQMIN.placeKind}cqmin`, color: accent, textTransform: "uppercase", letterSpacing: "0.04em" });
  const nameLine = document.createElement("div");
  nameLine.textContent = name;
  Object.assign(nameLine.style, { fontWeight: "800", fontSize: `${OVERLAY_FONT_CQMIN.placeName}cqmin`, lineHeight: "1.15", color: "#1a1a1a" });
  card.append(kindLine, nameLine);
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

// The marker offsets (px) of the aid bubbles and of the start / finish labels, and the tail that
// hangs under an aid card (cqmin).
const AID_MARKER_OFFSET_Y = -28;
const PLACE_MARKER_OFFSET_Y = -18;
const AID_TAIL_CQMIN = 1.2;

// Card sizes only change with the frame size: measured once per size, never inside the frame loop.
const labelSizeCache = new WeakMap<HTMLElement, { key: string; width: number; height: number }>();
const measureLabelCard = (card: HTMLElement, key: string) => {
  const cached = labelSizeCache.get(card);
  if (cached && cached.key === key) return cached;
  const measured = { key, width: card.offsetWidth, height: card.offsetHeight };
  labelSizeCache.set(card, measured);
  return measured;
};

/**
 * Hides the labels that overlap a more important one or that the frame edge would cut (see
 * label-layout.ts). The boxes come from the projection of each anchor through the current camera,
 * so the verdict only depends on the frame; it is written as `visibility` (the aid cards fade with
 * `opacity`, Mapbox owns the marker element), and only when it changes.
 */
const updateLabelLayout = (map: MapboxMap, labels: PinnedLabel[], isActive: (label: PinnedLabel) => boolean, terrainExaggeration: number) => {
  if (labels.length === 0 || typeof map.project !== "function") return;
  const container = map.getContainer();
  const frame = { width: container.clientWidth, height: container.clientHeight };
  // Not laid out (hidden tab, no size yet): leave the labels as they are.
  if (frame.width <= 0 || frame.height <= 0) return;
  const sizeKey = `${frame.width}x${frame.height}`;
  const cqminPx = Math.min(frame.width, frame.height) / 100;
  const candidates = labels.map((label): LabelCandidate => {
    const size = measureLabelCard(label.card, sizeKey);
    const anchor = map.project([label.lon, label.lat], label.elevationM * terrainExaggeration);
    const projected = Number.isFinite(anchor.x) && Number.isFinite(anchor.y) && anchor.x < Number.MAX_VALUE && size.width > 0;
    return {
      id: label.id,
      kind: label.kind,
      active: isActive(label),
      box: projected ? getPinnedLabelBox(anchor, size, label.offsetY, label.tailCqmin * cqminPx) : null,
    };
  });
  const verdicts = resolveLabelVisibility(candidates, frame);
  labels.forEach((label) => {
    const hidden = verdicts.get(label.id) === false;
    if (hidden !== label.hidden) {
      label.hidden = hidden;
      label.card.style.visibility = hidden ? "hidden" : "visible";
    }
  });
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

/** What the one-click reel steps hand to each other. */
type ReelRunContext = { overrides?: Record<string, string>; content?: ReelContent; clips?: Record<string, NarrationClip>; jobId?: string };
const newReelRunContext = (): ReelRunContext => ({});

/** A clip only counts while its text still matches the narration it was generated from. */
const freshClipsFor = (beats: Array<{ id: string; narration: string }>, clips: Record<string, NarrationClip>) =>
  beats.flatMap((beat) => clips[beat.id]?.text === beat.narration ? [clips[beat.id]] : []);

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

  // Above the revealed route (so it also shows in "full" reveal mode), under the station icons.
  if (!map.getSource(TOLD_SLOPE_SOURCE_ID)) {
    map.addSource(TOLD_SLOPE_SOURCE_ID, { type: "geojson", data: EMPTY_FEATURES as unknown as GeoJsonSourceData, tolerance: 0 });
  }
  const beforeIcons = map.getLayer(MARKER_ICON_LAYER_ID) ? MARKER_ICON_LAYER_ID : undefined;
  if (!map.getLayer(TOLD_SLOPE_CASING_LAYER_ID)) {
    map.addLayer({
      id: TOLD_SLOPE_CASING_LAYER_ID,
      type: "line",
      source: TOLD_SLOPE_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": ROUTE_CASING_WIDTHS[settings.routeWidth], "line-opacity": 0, "line-emissive-strength": 1 },
    }, beforeIcons);
  }
  if (!map.getLayer(TOLD_SLOPE_LAYER_ID)) {
    map.addLayer({
      id: TOLD_SLOPE_LAYER_ID,
      type: "line",
      source: TOLD_SLOPE_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": lineWidth, "line-opacity": 0, "line-emissive-strength": 1 },
    }, beforeIcons);
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

export function VideoGeneratorMapClient({ accessToken: sessionToken, aidStations, bounds, points, race, render }: VideoGeneratorMapProps) {
  const renderSnapshot = render?.snapshot;
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const [exportLayout, setExportLayout] = useState<{ width: number; height: number; scale: number } | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });
  const [soundtrack, setSoundtrack] = useState<SoundtrackReport | null>(null);
  const [musicManifest, setMusicManifest] = useState<ReelMusicManifest>(EMPTY_REEL_MUSIC_MANIFEST);
  useEffect(() => {
    if (render) return;
    let cancelled = false;
    void loadReelMusicManifest().then((manifest) => { if (!cancelled) setMusicManifest(manifest); });
    return () => { cancelled = true; };
  }, [render]);
  const mapRef = useRef<MapboxMap | null>(null);
  const cameraRef = useRef<RouteCameraController | null>(null);
  const animationRef = useRef<RouteAnimationController | null>(null);
  const resizeRef = useRef<MapResizeController | null>(null);
  const progressMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const aidBubblesRef = useRef<AidBubble[]>([]);
  // Told slope on the map: data changes once per beat, opacity only when its rounded value moves.
  const toldSlopeIdRef = useRef<string | null>(null);
  const toldSlopeOpacityRef = useRef(-1);
  const placeLabelsRef = useRef<PinnedLabel[]>([]);
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

  const [settings, setSettings] = useState<VideoCompositionSettings>(renderSnapshot?.settings ?? INITIAL_EDITOR_SETTINGS);
  const [preparedPath, setPreparedPath] = useState<PreparedAnimationPath>(() => prepareAnimationPath(points));
  const [mapError, setMapError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [snapshot, setSnapshot] = useState<AnimationPlaybackSnapshot>(initialSnapshot);
  const [webGlAvailable] = useState(() => typeof document === "undefined" || supportsWebGl());

  // Canonical figures: the race record is the announced truth, the GPX is rescaled to it.
  const figures = useMemo(() => buildRaceFigures({
    raceDistanceKm: race.distanceKm,
    raceElevationGainM: race.elevationGainM,
    routeDistanceKm: preparedPath.totalDistanceKm,
    routeElevationGainM: getCumulativeGainAt(preparedPath, preparedPath.totalDistanceKm),
  }), [preparedPath, race.distanceKm, race.elevationGainM]);
  useEffect(() => {
    figures.warnings.forEach((warning) => console.warn(`Video generator figures: ${warning}`));
  }, [figures.warnings]);
  // Organizer stations are in announced kilometres: placed on the GPX once, in route kilometres.
  const routeAidStations = useMemo(() => toRouteAidStations(figures, aidStations), [aidStations, figures]);
  const enabledAidStations = useMemo(() => {
    const disabled = new Set(settings.disabledAidStationIds);
    return routeAidStations.filter((station) => !disabled.has(station.id));
  }, [routeAidStations, settings.disabledAidStationIds]);
  const routeData = useMemo(() => buildRouteGeoJson(points), [points]);
  const lineProgressTable = useMemo(() => buildLineProgressTable(points), [points]);
  // Start, finish and station icons at the exact route point of their kilometre.
  const markerData = useMemo(() => buildStationIconGeoJson(preparedPath, enabledAidStations), [enabledAidStations, preparedPath]);

  // The story: detected moments with a default narration, overridden by the AI or by hand.
  const isHighlights = settings.storyMode === "highlights";
  // A highlights reel aims at 40 s (30 to 50 s); a full flyover grows with the route.
  const autoDurationSeconds = isHighlights ? HIGHLIGHT_TARGET_SECONDS : getAutoDurationSeconds(preparedPath.totalDistanceKm);
  const maxSeconds = settings.durationMode === "auto"
    ? autoDurationSeconds
    : isHighlights ? Math.min(HIGHLIGHT_MAX_SECONDS, Math.max(HIGHLIGHT_MIN_SECONDS, settings.durationSeconds)) : settings.durationSeconds;
  const [landmarks, setLandmarks] = useState<StoryLandmarks>(renderSnapshot?.landmarks ?? {});
  // Estimated passing time at each kilometre (classic pace, cutoffs) for the day/night look.
  const raceClock = useMemo(() => buildRaceClock(preparedPath, enabledAidStations, race), [enabledAidStations, preparedPath, race]);
  const activeClock = settings.dayNight ? raceClock : null;
  const daylightAt = useCallback(
    (distanceKm: number) => (activeClock ? getDaylightAt(activeClock, distanceKm) : null),
    [activeClock],
  );
  const defaultBeats = useMemo(() => {
    if (isHighlights) {
      // The night passage is picked from the estimated clock even when the day/night look is off.
      const highlights = selectHighlights(preparedPath, settings.showAidStations ? enabledAidStations : [], raceClock, figures, { landmarks });
      return buildHighlightBeats(highlights, preparedPath, race, { figures, landmarks });
    }
    return buildStoryBeats(preparedPath, enabledAidStations, race, {
      maxSeconds,
      includeAidStations: settings.showAidStations,
      includeStart: settings.showStartInfo,
      landmarks,
      daylightAt,
      figures,
    });
  }, [daylightAt, enabledAidStations, figures, isHighlights, landmarks, maxSeconds, preparedPath, race, raceClock, settings.showAidStations, settings.showStartInfo]);

  // Summit names make the story concrete ("la montée vers le Mont Thou"): ask Mapbox for the
  // highest named peak near each climb top, once per route.
  useEffect(() => {
    // A background render replays the summit names saved with the composition.
    if (renderSnapshot || !accessToken || !preparedPath.canAnimate) return;
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
  }, [accessToken, preparedPath, renderSnapshot]);
  // Start and finish names for the map labels, looked up once per route (saved with a render).
  const [endpointNames, setEndpointNames] = useState<EndpointNames>(renderSnapshot?.placeNames ?? { start: null, finish: null });
  useEffect(() => {
    if (renderSnapshot || !preparedPath.canAnimate) return;
    const controller = new AbortController();
    const start = getRoutePointAtDistance(preparedPath, 0);
    const finish = getRoutePointAtDistance(preparedPath, preparedPath.totalDistanceKm);
    const lookup = (lon: number, lat: number) => (accessToken ? fetchNearestPlaceName(lon, lat, accessToken, controller.signal) : Promise.resolve(null));
    void resolveEndpointNames(start, finish, race.startPlace, lookup).then((names) => {
      if (!controller.signal.aborted) setEndpointNames(names);
    });
    return () => controller.abort();
  }, [accessToken, preparedPath, race.startPlace, renderSnapshot]);
  const [narrationOverrides, setNarrationOverrides] = useState<Record<string, string>>(renderSnapshot?.narrationOverrides ?? {});
  const beats = useMemo<StoryBeat[]>(
    () => defaultBeats.map((beat) => narrationOverrides[beat.id] !== undefined ? { ...beat, narration: narrationOverrides[beat.id] } : beat),
    [defaultBeats, narrationOverrides],
  );
  const [voiceClips, setVoiceClips] = useState<Record<string, NarrationClip>>(
    () => Object.fromEntries((renderSnapshot?.voiceClips ?? []).map((clip) => [clip.beatId, clip])),
  );
  const [voiceId, setVoiceId] = useState("");
  // Storytelling: a random style by default so reels vary, and the admin's instructions for this race.
  const [scriptStyle, setScriptStyle] = useState<ScriptStyleChoice>("auto");
  const [scriptNotes, setScriptNotes] = useState("");
  useEffect(() => {
    if (!render) setScriptNotes(loadScriptNotes(race.id));
  }, [race.id, render]);
  const updateScriptNotes = (notes: string) => {
    setScriptNotes(notes);
    storeScriptNotes(race.id, notes);
  };
  // Voices used or saved in this browser; the last one used is picked again on the next visit.
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
  useEffect(() => {
    if (render) return;
    const library = loadVoiceLibrary();
    setSavedVoices(library);
    const lastUsed = getLastUsedVoiceId(library);
    if (lastUsed) setVoiceId((current) => current || lastUsed);
  }, [render]);
  const updateVoiceLibrary = (update: (voices: SavedVoice[]) => SavedVoice[]) => {
    setSavedVoices((current) => {
      const next = update(current);
      storeVoiceLibrary(next);
      return next;
    });
  };
  // Expressive and lively by default: the reels are told like a friend's briefing.
  const [voiceOptions, setVoiceOptions] = useState<VoiceOptions>({ model: "v3", expressiveness: 0.9 });
  // Measured pace of each voice, so the next script is sized to the reel length.
  const [speechRates, setSpeechRates] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!render) setSpeechRates(loadSpeechRates());
  }, [render]);
  const speechRateKey = getSpeechRateKey(voiceOptions.model, voiceId);
  const [scriptState, setScriptState] = useState<AsyncActionState>(IDLE_ACTION);
  // Highlights reel text written in one call (hook, call to action, caption, hashtags, cover text):
  // kept with the narration, saved with it and snapshotted on the render job. Null until written or loaded.
  const [reelContent, setReelContent] = useState<ReelContent | null>(null);
  const [reelWarnings, setReelWarnings] = useState<ReelContentWarning[]>([]);
  const [coverText, setCoverText] = useState("");
  const [voiceState, setVoiceState] = useState<AsyncActionState>(IDLE_ACTION);
  const [instagramCaption, setInstagramCaption] = useState("");
  const [instagramHashtags, setInstagramHashtags] = useState<string[]>([]);
  const [instagramState, setInstagramState] = useState<AsyncActionState>(IDLE_ACTION);
  // A clip only counts while its text still matches the narration it was generated from.
  const freshClips = useMemo(() => freshClipsFor(beats, voiceClips), [beats, voiceClips]);
  const narrationAlignments = useMemo<NarrationAlignments>(
    () => Object.fromEntries(freshClips.flatMap((clip) => clip.characterEndMs ? [[clip.beatId, { characterEndMs: clip.characterEndMs, characterStartMs: clip.characterStartMs }]] : [])),
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
    // Labels hidden when they overlap a more important one or would be cut by the frame edge.
    updateLabelLayout(
      map,
      [...aidBubblesRef.current, ...placeLabelsRef.current],
      (label) => (label.kind === "aid" ? (label as AidBubble).opacity > 0 : true),
      settingsRef.current.terrainExaggeration,
    );
    const toldSlope = settingsRef.current.highlightToldSlopes ? getToldSlope(frame) : null;
    const toldSource = map.getSource(TOLD_SLOPE_SOURCE_ID) as GeoJSONSource | undefined;
    if (toldSource && (toldSlope?.id ?? null) !== toldSlopeIdRef.current) {
      toldSlopeIdRef.current = toldSlope?.id ?? null;
      toldSource.setData((toldSlope ? buildToldSlopeGeoJson(path, toldSlope.startKm, toldSlope.endKm) : EMPTY_FEATURES) as unknown as GeoJsonSourceData);
    }
    const toldOpacity = Math.round((toldSlope?.opacity ?? 0) * 20) / 20;
    if (toldOpacity !== toldSlopeOpacityRef.current && map.getLayer(TOLD_SLOPE_LAYER_ID)) {
      toldSlopeOpacityRef.current = toldOpacity;
      map.setPaintProperty(TOLD_SLOPE_LAYER_ID, "line-opacity", toldOpacity);
      if (map.getLayer(TOLD_SLOPE_CASING_LAYER_ID)) map.setPaintProperty(TOLD_SLOPE_CASING_LAYER_ID, "line-opacity", toldOpacity);
    }
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
  }, [refreshCurrentFrame, settings.highlightToldSlopes, settings.revealMode, settings.showAidBubbles]);

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
    if (map.getLayer(TOLD_SLOPE_LAYER_ID)) map.setPaintProperty(TOLD_SLOPE_LAYER_ID, "line-width", lineWidth);
    if (map.getLayer(TOLD_SLOPE_CASING_LAYER_ID)) map.setPaintProperty(TOLD_SLOPE_CASING_LAYER_ID, "line-width", ROUTE_CASING_WIDTHS[settings.routeWidth]);
    if (map.getLayer(ROUTE_GLOW_LAYER_ID)) {
      map.setPaintProperty(ROUTE_GLOW_LAYER_ID, "line-color", `${settings.routeColor}${GLOW_ROUTE_ALPHA_HEX}`);
      map.setLayoutProperty(ROUTE_GLOW_LAYER_ID, "visibility", settings.routeGlow ? "visible" : "none");
    }
    if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
      map.setPaintProperty(ROUTE_CASING_LAYER_ID, "line-width", ROUTE_CASING_WIDTHS[settings.routeWidth]);
      map.setLayoutProperty(ROUTE_CASING_LAYER_ID, "visibility", settings.routeCasing ? "visible" : "none");
    }
  }, [settings.routeCasing, settings.routeColor, settings.routeGlow, settings.routeWidth]);

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
  const compactOverlay = isCompactOverlayEnabled(settings);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;
    const bubbles = enabledAidStations
      .filter((station) => station.distanceKm > 0 && station.distanceKm < preparedPath.totalDistanceKm)
      .map((station): AidBubble => {
        const point = getRoutePointAtDistance(preparedPath, station.distanceKm);
        const { element, card } = createAidCardElement(station, getCumulativeGainAt(preparedPath, station.distanceKm), settings.accentColor, figures, compactOverlay);
        // The card tail stops a few pixels above the station icon drawn by the map (about 15 px
        // radius), so the bubble floats over its station instead of touching it.
        const marker = new mapboxgl.Marker({ element, anchor: "center", offset: [0, AID_MARKER_OFFSET_Y], occludedOpacity: 1 })
          .setLngLat([point.lon, point.lat])
          .addTo(map);
        return {
          id: `aid-${station.id}`,
          kind: "aid",
          distanceKm: station.distanceKm,
          card,
          marker,
          lon: point.lon,
          lat: point.lat,
          elevationM: point.elevationM,
          offsetY: AID_MARKER_OFFSET_Y,
          tailCqmin: AID_TAIL_CQMIN,
          hidden: false,
          opacity: -1,
        };
      });
    aidBubblesRef.current = bubbles;
    refreshCurrentFrame();
    return () => {
      bubbles.forEach((bubble) => bubble.marker.remove());
      aidBubblesRef.current = [];
    };
  }, [compactOverlay, enabledAidStations, figures, isReady, preparedPath, refreshCurrentFrame, settings.accentColor]);

  // Start and finish names, pinned above their icons for the whole reel.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady || !settings.showPlaceNames || !preparedPath.canAnimate) return;
    // A loop (start and finish under 1,500 m apart) gets one « Départ / Arrivée » label.
    const startPoint = getRoutePointAtDistance(preparedPath, 0);
    const finishPoint = getRoutePointAtDistance(preparedPath, preparedPath.totalDistanceKm);
    const labels = getEndpointLabelSpecs(endpointNames, startPoint, finishPoint).map((spec): PinnedLabel => {
      const point = spec.atFinish ? finishPoint : startPoint;
      const { element, card } = createPlaceLabelElement(spec.kind, spec.name, settings.accentColor);
      const marker = new mapboxgl.Marker({ element, anchor: "center", offset: [0, PLACE_MARKER_OFFSET_Y], occludedOpacity: 1 })
        .setLngLat([point.lon, point.lat])
        .addTo(map);
      return { id: `place-${spec.id}`, kind: "endpoint", card, marker, lon: point.lon, lat: point.lat, elevationM: point.elevationM, offsetY: PLACE_MARKER_OFFSET_Y, tailCqmin: 0, hidden: false };
    });
    placeLabelsRef.current = labels;
    refreshCurrentFrame();
    return () => {
      labels.forEach((label) => label.marker.remove());
      placeLabelsRef.current = [];
    };
  }, [endpointNames, isReady, preparedPath, refreshCurrentFrame, settings.accentColor, settings.showPlaceNames]);

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

  // Race figures sent to the script and caption writers: the announced totals, rounded as shown.
  const announcedRace = {
    title: race.title,
    subtitle: race.subtitle,
    distanceKm: roundTotalKm(figures.distanceKm),
    elevationGainM: getAnnouncedElevationGainM(figures),
  };

  const authorizedPost = (url: string, body: unknown) => fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  /** The reel text as it stands: current narrations (hand edits included), caption, hashtags, cover text. */
  const currentReelContent = () => assembleReelContent({
    base: reelContent,
    narrations: beats.map((beat) => ({ id: beat.id, text: beat.narration })),
    caption: instagramCaption,
    hashtags: instagramHashtags,
    coverText,
  });

  // Saved narration of this race, one per story mode (text, settings, voice): each mode is restored
  // once, when the race opens or when the mode is first chosen, and saved after every AI draft or
  // voice generation and on demand, so a race is written and voiced once per mode.
  const [savedNarration, setSavedNarration] = useState<AsyncActionState>(IDLE_ACTION);
  const [pendingSave, setPendingSave] = useState<{ clips: boolean } | null>(null);
  const loadedNarrationsRef = useRef(new Set<string>());
  const requestSave = (clips: boolean) => setPendingSave({ clips });
  const storyMode = settings.storyMode;
  useEffect(() => {
    if (render || !race.id || !sessionToken) return;
    const key = `${race.id}:${storyMode}`;
    if (loadedNarrationsRef.current.has(key)) return;
    const controller = new AbortController();
    setSavedNarration({ status: "loading", message: "Recherche d’un récit enregistré…" });
    void fetch(`/api/admin/video-generator/narrations/${race.id}?mode=${storyMode}`, { headers: { Authorization: `Bearer ${sessionToken}` }, cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response, "Le récit enregistré n’a pas pu être lu."));
        const parsed = savedNarrationResponseSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("Le récit enregistré est illisible.");
        const saved = parsed.data.narration;
        if (controller.signal.aborted) return;
        loadedNarrationsRef.current.add(key);
        if (!saved) {
          setSavedNarration(IDLE_ACTION);
          return;
        }
        // Settings first: they decide the story cut, hence which beat each saved text belongs to.
        // The mode stays the one being opened (older full saves have no storyMode).
        const restoredSettings = videoCompositionSettingsSchema.safeParse({ ...DEFAULT_VIDEO_COMPOSITION_SETTINGS, ...saved.settings, storyMode });
        if (restoredSettings.success) setSettings(restoredSettings.data);
        // Texts and clips of the other mode use other beat ids: keep them.
        setNarrationOverrides((current) => ({ ...current, ...saved.narrationOverrides }));
        if (saved.voice.voiceId) setVoiceId(saved.voice.voiceId);
        if (saved.voice.model && saved.voice.expressiveness !== undefined) {
          setVoiceOptions({ model: saved.voice.model, expressiveness: saved.voice.expressiveness });
        }
        setVoiceClips((current) => ({ ...current, ...Object.fromEntries(saved.clips.map((clip) => [clip.beatId, clip])) }));
        if (storyMode === "highlights" && saved.content) {
          setReelContent(saved.content);
          setInstagramCaption(saved.content.caption);
          setInstagramHashtags(saved.content.hashtags);
          setCoverText(saved.content.cover_text);
        }
        const when = new Date(saved.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
        const label = storyMode === "highlights" ? "Récit « Temps forts »" : "Récit";
        setSavedNarration({ status: "success", message: `${label} enregistré du ${when} chargé${saved.clips.length ? " avec sa voix off" : ""}.` });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setSavedNarration({ status: "error", message: error instanceof Error ? error.message : "Le récit enregistré n’a pas pu être lu." });
      });
    return () => controller.abort();
    // Once per race and mode: later edits are saved, never overwritten by a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.id, render, storyMode]);

  /**
   * Saves the narration of the current mode (the "Enregistrer" button, the AI draft, the voice and
   * the one-click reel share it). Each mode saves only its own texts: highlight beats are the
   * "hl-…" ids. Clips and content are written only when given.
   */
  const putNarration = async ({ texts, clips, content }: { texts: Record<string, string>; clips?: NarrationClip[]; content?: ReelContent | null }) => {
    const highlightsSave = settings.storyMode === "highlights";
    const response = await fetch(`/api/admin/video-generator/narrations/${race.id}?mode=${settings.storyMode}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        settings,
        narrationOverrides: Object.fromEntries(Object.entries(texts).filter(([beatId]) => beatId.startsWith("hl-") === highlightsSave)),
        voice: { voiceId: voiceId || null, ...voiceOptions },
        ...(clips ? { clips } : {}),
        ...(highlightsSave && content ? { content } : {}),
      }),
    });
    if (!response.ok) throw new Error(await readError(response, "Le récit n’a pas pu être enregistré."));
    const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `${highlightsSave ? "Récit « Temps forts »" : "Récit"} enregistré à ${time}${clips?.length ? " avec sa voix off" : ""}.`;
  };

  useEffect(() => {
    if (!pendingSave || !race.id) return;
    setPendingSave(null);
    setSavedNarration({ status: "loading", message: "Enregistrement du récit…" });
    putNarration({
      texts: narrationOverrides,
      ...(pendingSave.clips ? { clips: freshClips } : {}),
      content: reelContent ? currentReelContent() : null,
    })
      .then((message) => setSavedNarration({ status: "success", message }))
      .catch((error: unknown) => {
        setSavedNarration({ status: "error", message: error instanceof Error ? error.message : "Le récit n’a pas pu être enregistré." });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshClips, narrationOverrides, pendingSave, race.id, sessionToken, settings, voiceId, voiceOptions]);

  /** The writer call. A highlights reel is written in one call: script, hook, call to action, caption, hashtags, cover text. */
  const requestScript = async () => {
    const response = await authorizedPost(isHighlights ? "/api/admin/video-generator/content" : "/api/admin/video-generator/script", {
        mode: settings.storyMode,
        race: { ...announcedRace, startDetail: race.startDetail, ...(isHighlights ? { raceDate: race.raceDate ?? null } : {}) },
        ...(isHighlights ? {
          shortName: race.shortName ?? null,
          shockFigure: pickShockFigure(figures)?.text ?? null,
          aidStations: enabledAidStations.map((station) => ({
            name: station.name,
            km: roundKm(toAnnouncedKm(figures, station.distanceKm)),
            cutoffTime: station.cutoffTime ?? null,
          })),
        } : {}),
        targetSeconds: maxSeconds,
        wordsPerSecond: speechRates[speechRateKey],
        voiceModel: voiceOptions.model,
        notes: scriptNotes.trim() || undefined,
        style: scriptStyle === "auto" ? undefined : scriptStyle,
        beats: beats.map(({ id, kind, title, startKm, endKm, facts, services, cutoffTime, narration }) => ({
          id, kind, title, facts, services, cutoffTime, narration,
          // The writer only sees announced kilometres, like the captions and the badge.
          startKm: roundKm(toAnnouncedKm(figures, startKm)),
          endKm: roundKm(toAnnouncedKm(figures, endKm)),
          // Intro and outro have no span; a leg tells the stations it flies over before reaching them.
          passages: kind === "intro" || kind === "outro" || isHighlights
            ? []
            : getLegPassages(timeline, { startKm, endKm }, enabledAidStations).map((passage) => ({ ...passage, km: roundKm(toAnnouncedKm(figures, passage.km)) })),
        })),
      });
    if (!response.ok) throw new Error(await readError(response, "La narration n’a pas pu être rédigée."));
    return response;
  };

  /** Reads the highlights content of the writer call, and puts it in the editor (texts, caption, hashtags, cover text). */
  const applyHighlightsContent = async (response: Response) => {
    const content = reelContentResponseSchema.safeParse(await response.json());
    if (!content.success) throw new Error("Le contenu reçu est invalide.");
    setNarrationOverrides((current) => ({ ...current, ...buildNarrationOverrides(content.data.content) }));
    setReelContent(content.data.content);
    setReelWarnings(content.data.warnings);
    setInstagramCaption(content.data.content.caption);
    setInstagramHashtags(content.data.content.hashtags);
    setCoverText(content.data.content.cover_text);
    const styleKey = content.data.style as keyof typeof NARRATION_STYLE_LABELS | undefined;
    const styleLabel = styleKey && NARRATION_STYLE_LABELS[styleKey] ? ` (style : ${NARRATION_STYLE_LABELS[styleKey]})` : "";
    const toCheck = content.data.warnings.length ? ` ${content.data.warnings.length} point(s) à vérifier.` : "";
    setScriptState({ status: "success", message: `Contenu rédigé${styleLabel}.${toCheck} Relis-le puis génère la voix off.` });
    return content.data;
  };

  const writeScript = async () => {
    setScriptState({ status: "loading", message: "Claude rédige la narration…" });
    try {
      const response = await requestScript();
      if (isHighlights) {
        await applyHighlightsContent(response);
        requestSave(false);
        return;
      }
      const parsed = narrationScriptResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Le script reçu est invalide.");
      setNarrationOverrides((current) => ({ ...current, ...Object.fromEntries(parsed.data.beats.map((beat) => [beat.id, beat.narration])) }));
      const usedStyle = parsed.data.style ? ` (style : ${NARRATION_STYLE_LABELS[parsed.data.style]})` : "";
      setScriptState({ status: "success", message: `Narration rédigée${usedStyle}. Relis-la puis génère la voix off.` });
      requestSave(false);
    } catch (error) {
      setScriptState({ status: "error", message: error instanceof Error ? error.message : "La narration n’a pas pu être rédigée." });
    }
  };

  /** CSS size of the preview frame (inside its border), while it is not laid out for an export. */
  const measurePreviewFrame = () => {
    const frame = frameRef.current;
    return frame && !exportLayout ? { width: frame.clientWidth, height: frame.clientHeight } : null;
  };

  // MP4 export: the frame keeps the preview's CSS size (so the camera, the map details and the
  // bubbles match the preview) while the map renders at the video resolution; then every frame is
  // rendered, waited for and captured at the video size.
  const startExport = async () => {
    const map = mapRef.current;
    if (!map || !isReady || exportAbortRef.current) return;
    animationRef.current?.pause();
    narrationPlayerRef.current?.stop();
    const base = VIDEO_RESOLUTIONS[settings.resolution];
    const size = settings.viewport === "portrait" ? base : { width: base.height, height: base.width };
    const frame = getExportFrame(size, render ? renderSnapshot?.previewSize : measurePreviewFrame());
    // The background render page already forces the ratio before creating the map.
    const restorePixelRatio = render ? null : overrideDevicePixelRatio(frame.pixelRatio);
    if (exportState.status === "done") URL.revokeObjectURL(exportState.url);
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportState({ status: "running" });
    setSoundtrack(null);
    setExportLayout({ width: frame.width, height: frame.height, scale: 1 });
    let lastProgressAt = 0;
    try {
      await waitMs(80);
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
            // DOM markers take the terrain height known when the camera moved; the finer elevation
            // tiles loaded since can lift the station icons drawn by the map. Place them again so
            // every bubble sits on its icon in the captured frame.
            for (const marker of [...aidBubblesRef.current.map((bubble) => bubble.marker), ...placeLabelsRef.current.map((label) => label.marker), progressMarkerRef.current]) {
              marker?.setLngLat(marker.getLngLat());
            }
          },
          mapCanvas: () => map.getCanvas(),
          frameElement: () => {
            if (!frameRef.current) throw new Error("Aperçu introuvable.");
            return frameRef.current;
          },
        },
        narration: freshClips.length ? { clips: freshClips, cues: narrationCuesRef.current } : null,
        music: resolveMusicTrack(settings.musicTrack, race.id ?? race.title, await loadReelMusicManifest()),
        onSoundtrack: (report) => {
          setSoundtrack(report);
          // The background render has no panel: its console reaches the Cloud Run logs.
          if (render) console.info("[video-render] soundtrack", JSON.stringify(report.master), report.music?.id ?? "no-music", report.musicFailed ? "music-failed" : "");
        },
        onProgress: (progress) => {
          const now = performance.now();
          if (progress.phase === "rendering" && progress.frame < progress.totalFrames && now - lastProgressAt < 250) return;
          lastProgressAt = now;
          setExportState({ status: "running", progress });
          render?.onProgress(progress.phase === "rendering" ? progress.frame / progress.totalFrames : progress.phase === "finalizing" ? 1 : 0);
        },
        signal: controller.signal,
      });
      const fileName = `${race.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "parcours"}-reel.mp4`;
      if (render) render.onComplete(blob);
      else setExportState({ status: "done", url: URL.createObjectURL(blob), sizeBytes: blob.size, fileName });
    } catch (error) {
      const message = error instanceof Error ? error.message : "L’export a échoué.";
      render?.onError(message);
      if (error instanceof DOMException && error.name === "AbortError") setExportState({ status: "idle", message: "Export annulé." });
      else setExportState({ status: "error", message });
    } finally {
      exportAbortRef.current = null;
      restorePixelRatio?.();
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
        race: { ...announcedRace, startDetail: race.startDetail, raceDate: race.raceDate ?? null },
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

  /** The voice call for the given beats: clips kept in the editor and returned (the one-click reel needs them at once). */
  const requestVoiceClips = async (voiceBeats: Array<{ id: string; narration: string }>) => {
    const items = voiceBeats.filter((beat) => beat.narration.trim()).map((beat) => ({ id: beat.id, text: beat.narration.trim() }));
    setVoiceState({ status: "loading", message: `Génération de ${items.length} phrases avec ElevenLabs…` });
    const response = await authorizedPost("/api/admin/video-generator/voice", { voiceId: voiceId || null, items, ...voiceOptions });
    if (!response.ok) throw new Error(await readError(response, "La voix off n’a pas pu être générée."));
    const parsed = narrationVoiceResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("L’audio reçu est invalide.");
    // The clip keeps the exact narration text so it stays valid only while that text is unchanged.
    const textById = new Map(voiceBeats.map((beat) => [beat.id, beat.narration]));
    const clips: Record<string, NarrationClip> = Object.fromEntries(parsed.data.clips.map((clip) => [clip.id, {
      beatId: clip.id,
      text: textById.get(clip.id) ?? clip.text,
      audioBase64: clip.audioBase64,
      durationMs: clip.durationMs,
      characterEndMs: clip.characterEndMs,
      characterStartMs: clip.characterStartMs,
    }]));
    setVoiceClips((current) => ({ ...current, ...clips }));
    if (voiceId) updateVoiceLibrary((voices) => rememberVoice(voices, voiceId));
    const measured = measureWordsPerSecond(parsed.data.clips.map((clip) => ({ text: textById.get(clip.id) ?? clip.text, durationMs: clip.durationMs })));
    if (measured) {
      setSpeechRates((current) => {
        const next = { ...current, [speechRateKey]: measured };
        storeSpeechRates(next);
        return next;
      });
    }
    setVoiceState({ status: "success", message: "Voix off prête : lance la lecture." });
    return clips;
  };

  const generateVoice = async () => {
    try {
      await requestVoiceClips(beats);
      requestSave(true);
    } catch (error) {
      setVoiceState({ status: "error", message: error instanceof Error ? error.message : "La voix off n’a pas pu être générée." });
    }
  };

  // Background render: export as soon as the map and its layers are ready, once.
  const renderStartedRef = useRef(false);
  const startExportRef = useRef(startExport);
  startExportRef.current = startExport;
  useEffect(() => {
    if (!render || !isReady || renderStartedRef.current) return;
    renderStartedRef.current = true;
    void startExportRef.current();
  }, [isReady, render]);

  /** The composition sent to the renderer; the one-click reel passes the texts and clips it has just made. */
  const createRenderSnapshot = (own?: { narrationOverrides: Record<string, string>; voiceClips: NarrationClip[] }): VideoRenderSnapshot => ({
    version: 1,
    race,
    aidStations,
    bounds,
    points,
    settings,
    narrationOverrides: own?.narrationOverrides ?? narrationOverrides,
    landmarks,
    placeNames: endpointNames,
    voiceClips: own?.voiceClips ?? freshClips,
    previewSize: measurePreviewFrame(),
  });

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
      daylightKeyRef.current = null;
      toldSlopeIdRef.current = null;
      toldSlopeOpacityRef.current = -1;
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

  // One-click reel: the steps of the manual flow (AI text, voice, save, background render) chained
  // on the same functions as the individual buttons. Each step hands its result to the next one
  // explicitly, so the chain never depends on React having re-rendered in between.
  const [renderRefresh, setRenderRefresh] = useState(0);
  const highlightsNarrationLoaded = loadedNarrationsRef.current.has(`${race.id}:highlights`) || savedNarration.status === "error";
  const pipelineReadyRef = useRef(false);
  pipelineReadyRef.current = isHighlights && highlightsNarrationLoaded;
  const beatsWithTexts = (overrides?: Record<string, string>) => {
    const texts = { ...narrationOverrides, ...overrides };
    return defaultBeats.map((beat) => texts[beat.id] !== undefined ? { ...beat, narration: texts[beat.id] } : beat);
  };
  const reelRunners: ReelPipelineRunners<ReelRunContext> = {
    // Temps forts mode, with its saved narration loaded first (it would overwrite a fresh draft).
    prepare: async () => {
      if (!isHighlights) updateSettings(withStoryMode(settings, "highlights"));
      await waitUntil(() => pipelineReadyRef.current, { message: "Le récit « Temps forts » n’a pas pu être préparé." });
    },
    text: async () => {
      setScriptState({ status: "loading", message: "Claude rédige la narration…" });
      try {
        const data = await applyHighlightsContent(await requestScript());
        return { overrides: buildNarrationOverrides(data.content), content: data.content, warnings: data.warnings.map((warning) => warning.message) };
      } catch (error) {
        setScriptState({ status: "error", message: error instanceof Error ? error.message : "La narration n’a pas pu être rédigée." });
        throw error;
      }
    },
    voice: async (context) => {
      try {
        return { clips: await requestVoiceClips(beatsWithTexts(context.overrides)) };
      } catch (error) {
        setVoiceState({ status: "error", message: error instanceof Error ? error.message : "La voix off n’a pas pu être générée." });
        throw error;
      }
    },
    save: async (context) => {
      setSavedNarration({ status: "loading", message: "Enregistrement du récit…" });
      try {
        const message = await putNarration({
          texts: { ...narrationOverrides, ...context.overrides },
          clips: freshClipsFor(beatsWithTexts(context.overrides), context.clips ?? voiceClips),
          content: context.content ?? (reelContent ? currentReelContent() : null),
        });
        setSavedNarration({ status: "success", message });
      } catch (error) {
        setSavedNarration({ status: "error", message: error instanceof Error ? error.message : "Le récit n’a pas pu être enregistré." });
        throw error;
      }
    },
    render: async (context) => {
      const content = context.content ?? (reelContent ? currentReelContent() : null);
      if (!race.id || !content) throw new Error("Le texte du reel est manquant : relance depuis la rédaction.");
      const clips = freshClipsFor(beatsWithTexts(context.overrides), context.clips ?? voiceClips);
      const { jobId } = await launchBackgroundRender({
        accessToken: sessionToken,
        raceId: race.id,
        raceTitle: race.title,
        snapshot: createRenderSnapshot({ narrationOverrides: { ...narrationOverrides, ...context.overrides }, voiceClips: clips }),
        content,
        autoDraft: true,
      });
      setRenderRefresh((version) => version + 1);
      return { jobId };
    },
  };
  const reelPipeline = useReelPipeline(reelRunners, newReelRunContext);

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
            figures={figures}
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
        {render ? null : (
        <div className={portrait ? "w-full max-w-md" : "w-full"}>
          <AnimationControls
            canAnimate={preparedPath.canAnimate}
            currentDistanceKm={toAnnouncedKm(figures, currentFrame.distanceKm)}
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
            totalDistanceKm={figures.distanceKm}
          />
        </div>
        )}
      </section>

      {render ? null : (
      <div className="h-fit space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Narration</CardTitle>
        </CardHeader>
        <CardContent>
          <ReelPipelinePanel
            canRun={preparedPath.canAnimate && Boolean(race.id) && scriptState.status !== "loading" && voiceState.status !== "loading" && exportState.status !== "running"}
            pipeline={reelPipeline}
          />
          <StoryEditor
            beats={timeline.beats}
            onSaveNarration={() => requestSave(true)}
            savedNarration={savedNarration}
            durationControl={<DurationSelect autoDurationSeconds={autoDurationSeconds} onChange={updateSettings} settings={settings} />}
            narrationOverflow={timeline.narrationOverflow}
            onGenerateVoice={() => void generateVoice()}
            onNarrationChange={(beatId, narration) => setNarrationOverrides((current) => ({ ...current, [beatId]: narration }))}
            onResetScript={() => {
              setNarrationOverrides({});
              setScriptState(IDLE_ACTION);
              setReelWarnings([]);
            }}
            onForgetVoice={(id) => updateVoiceLibrary((voices) => forgetVoice(voices, id))}
            onSaveVoice={(id, name) => updateVoiceLibrary((voices) => nameVoice(voices, id, name))}
            onVoiceIdChange={setVoiceId}
            onVoiceOptionsChange={setVoiceOptions}
            voiceOptions={voiceOptions}
            onScriptNotesChange={updateScriptNotes}
            onScriptStyleChange={setScriptStyle}
            scriptNotes={scriptNotes}
            scriptStyle={scriptStyle}
            scriptWarnings={isHighlights ? reelWarnings.filter((warning) => ["hook", "script_segments", "cta"].includes(warning.field)).map((warning) => warning.message) : []}
            onWriteScript={() => void writeScript()}
            scriptState={scriptState}
            totalMs={timeline.totalMs}
            voiceId={voiceId}
            voiceReadyIds={new Set(Object.keys(narrationDurations))}
            voiceState={voiceState}
            voices={savedVoices}
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
            soundtrack={soundtrack}
            state={exportState}
          />
          <BackgroundRenderPanel
            accessToken={sessionToken}
            canRender={isReady && preparedPath.canAnimate && exportState.status !== "running"}
            createSnapshot={() => createRenderSnapshot()}
            hasVoice={freshClips.length > 0}
            reelContent={isHighlights && reelContent ? currentReelContent() : null}
            raceId={race.id}
            raceTitle={race.title}
            resolutionLabel={settings.resolution}
            refreshSignal={renderRefresh}
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
            coverText={isHighlights ? coverText : undefined}
            onCoverTextChange={setCoverText}
            warnings={isHighlights ? reelWarnings.filter((warning) => ["caption", "hashtags", "cover_text"].includes(warning.field)).map((warning) => warning.message) : []}
            onCaptionChange={setInstagramCaption}
            // In highlights mode the caption comes with the script (« Rédiger avec l’IA »).
            onGenerate={isHighlights ? undefined : () => void writeInstagramCaption()}
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
            dayNightAvailable={raceClock !== null}
            narratedIds={new Set(beats.map((beat) => beat.id))}
            aidStations={aidStations}
            cameraActionsDisabled={!isReady || snapshot.isPlaying}
            musicTracks={musicManifest.tracks}
            onChange={updateSettings}
            onFitOverview={() => cameraRef.current?.fitOverview()}
            onResetCamera={() => cameraRef.current?.reset()}
            settings={settings}
          />
        </CardContent>
      </Card>
      </div>
      )}
    </>
  );
}
