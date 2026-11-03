"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapboxEvent,
} from "mapbox-gl";

import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { buildMarkerGeoJson, buildRouteGeoJson } from "../../../lib/video-generator";
import { AnimationControls } from "./AnimationControls";
import {
  createRouteAnimationController,
  type AnimationPlaybackSnapshot,
  type RouteAnimationController,
} from "./animation-controller";
import { createRouteCameraController, type RouteCameraController } from "./camera-controller";
import { CompositionSettingsPanel } from "./CompositionSettingsPanel";
import {
  applyMapAppearance,
  captureMapAppearanceState,
  resolveMapStyleUrl,
  ROUTE_GLOW_WIDTH,
  ROUTE_LINE_WIDTHS,
  type MapAppearanceState,
} from "./map-appearance";
import { observeMapSize, type MapResizeController } from "./map-resize-controller";
import {
  getRoutePointAtDistance,
  prepareAnimationPath,
  type PreparedAnimationPath,
  type RouteRevealMode,
} from "./route-animation";
import {
  buildElevationProfile,
  buildVideoTimeline,
  DEFAULT_VIDEO_COMPOSITION_SETTINGS,
  getGradeAtDistance,
  getVideoCameraPose,
  getVideoFrameState,
  type VideoCompositionSettings,
} from "./video-composition";
import { createVideoFrameStore, VideoCompositionOverlay } from "./VideoCompositionOverlay";
import type { VideoGeneratorMapProps } from "./VideoGeneratorMap";

const TERRAIN_SOURCE_ID = "video-terrain-dem";
const ROUTE_SOURCE_ID = "video-route";
const ROUTE_LAYER_ID = "video-route-line";
const ROUTE_REVEAL_LAYER_ID = "video-route-line-reveal";
const ROUTE_GLOW_LAYER_ID = "video-route-line-glow";
const MARKER_SOURCE_ID = "video-route-markers";
const MARKER_CIRCLE_LAYER_ID = "video-route-marker-circles";
const MARKER_LABEL_LAYER_ID = "video-route-marker-labels";
export const VIDEO_ROUTE_COLOR = DEFAULT_VIDEO_COMPOSITION_SETTINGS.routeColor;
const FUTURE_ROUTE_ALPHA_HEX = "38";
const GLOW_ROUTE_ALPHA_HEX = "8c";
const OWN_LAYER_IDS = new Set([
  ROUTE_LAYER_ID,
  ROUTE_GLOW_LAYER_ID,
  ROUTE_REVEAL_LAYER_ID,
  MARKER_CIRCLE_LAYER_ID,
  MARKER_LABEL_LAYER_ID,
]);

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

const createProgressMarkerElement = (color: string) => {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  Object.assign(element.style, {
    width: "16px",
    height: "16px",
    borderRadius: "9999px",
    background: color,
    border: "3px solid #172012",
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
  else map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: routeData as GeoJsonSourceData, lineMetrics: true });

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

export function VideoGeneratorMapClient({ aidStations, bounds, points, race }: VideoGeneratorMapProps) {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const cameraRef = useRef<RouteCameraController | null>(null);
  const animationRef = useRef<RouteAnimationController | null>(null);
  const resizeRef = useRef<MapResizeController | null>(null);
  const progressMarkerRef = useRef<mapboxgl.Marker | null>(null);
  // `map.isStyleLoaded()` is false whenever a tile is loading or a source was just updated, which is
  // permanently the case while the camera flies. Gating frames on it skipped most of them.
  const layersReadyRef = useRef(false);
  const appearanceStateRef = useRef<MapAppearanceState>({ basemapSymbolLayerIds: [] });
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
  const markerData = useMemo(() => buildMarkerGeoJson(points, enabledAidStations), [enabledAidStations, points]);
  const timeline = useMemo(
    () => buildVideoTimeline(preparedPath, aidStations, settings, { detail: race.startDetail }),
    [aidStations, preparedPath, race.startDetail, settings],
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
  markerDataRef.current = markerData;

  const applyAnimationTime = useCallback((timeMs: number) => {
    const frame = getVideoFrameState(timelineRef.current, timeMs);
    frameStore.set(frame);
    const map = mapRef.current;
    const camera = cameraRef.current;
    const path = preparedPathRef.current;
    if (!map || !layersReadyRef.current || !camera || !path.canAnimate) return;

    camera.applyAnimationFrame(getVideoCameraPose(path, timelineRef.current, frame, settingsRef.current.viewport));
    const trimOffset = buildRouteTrimOffset(settingsRef.current.revealMode, frame.routeProgress);
    if (map.getLayer(ROUTE_REVEAL_LAYER_ID)) map.setPaintProperty(ROUTE_REVEAL_LAYER_ID, "line-trim-offset", trimOffset);
    if (map.getLayer(ROUTE_GLOW_LAYER_ID)) map.setPaintProperty(ROUTE_GLOW_LAYER_ID, "line-trim-offset", trimOffset);
    const routePoint = getRoutePointAtDistance(path, frame.distanceKm);
    progressMarkerRef.current?.setLngLat([routePoint.lon, routePoint.lat]);

    const activeAidDistance = frame.aidLabel?.distanceKm ?? null;
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
  }, [refreshCurrentFrame, settings.revealMode]);

  useEffect(() => {
    const map = mapRef.current;
    const markerElement = progressMarkerRef.current?.getElement();
    if (markerElement) markerElement.style.background = settings.routeColor;
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
    if (map.getLayer(ROUTE_GLOW_LAYER_ID)) {
      map.setPaintProperty(ROUTE_GLOW_LAYER_ID, "line-color", `${settings.routeColor}${GLOW_ROUTE_ALPHA_HEX}`);
      map.setLayoutProperty(ROUTE_GLOW_LAYER_ID, "visibility", settings.routeGlow ? "visible" : "none");
    }
  }, [settings.routeColor, settings.routeGlow, settings.routeWidth]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    applyMapAppearance(map, settingsRef.current, appearanceStateRef.current, OWN_LAYER_IDS);
  }, [settings.hideMapLabels, settings.mapAmbiance]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current || !map.getSource(TERRAIN_SOURCE_ID)) return;
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: settings.terrainExaggeration });
  }, [settings.terrainExaggeration]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) setMapInteractionsEnabled(map, !snapshot.isPlaying);
  }, [snapshot.isPlaying]);

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
      // Mapbox terms require the logo and attribution; keep them compact and away from the overlay.
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
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
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
            onRestart={() => animationRef.current?.restart()}
            onSeek={(progress) => animationRef.current?.seek(progress)}
            snapshot={snapshot}
            totalDistanceKm={preparedPath.totalDistanceKm}
          />
        </div>
      </section>

      <Card className="h-fit lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Composition vidéo</CardTitle>
        </CardHeader>
        <CardContent>
          <CompositionSettingsPanel
            aidLabels={timeline.aidLabels}
            aidStations={aidStations}
            cameraActionsDisabled={!isReady || snapshot.isPlaying}
            onChange={updateSettings}
            onFitOverview={() => cameraRef.current?.fitOverview()}
            onResetCamera={() => cameraRef.current?.reset()}
            settings={settings}
          />
        </CardContent>
      </Card>
    </>
  );
}
