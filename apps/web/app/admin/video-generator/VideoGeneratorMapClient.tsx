"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapboxEvent,
} from "mapbox-gl";

import { Button } from "../../../components/ui/button";
import { buildMarkerGeoJson, buildRouteGeoJson } from "../../../lib/video-generator";
import { AnimationControls } from "./AnimationControls";
import {
  createRouteAnimationController,
  type AnimationPlaybackSnapshot,
  type RouteAnimationController,
} from "./animation-controller";
import { createRouteCameraController, type RouteCameraController } from "./camera-controller";
import { observeMapSize, type MapResizeController } from "./map-resize-controller";
import {
  getCameraStateAtTime,
  prepareAnimationPath,
  TERRAIN_EXAGGERATION,
  type AnimationViewport,
  type PreparedAnimationPath,
  type PreparedRoutePoint,
  type RouteRevealMode,
} from "./route-animation";
import type { VideoGeneratorMapProps } from "./VideoGeneratorMap";

const TERRAIN_SOURCE_ID = "video-terrain-dem";
const ROUTE_SOURCE_ID = "video-route";
const ROUTE_LAYER_ID = "video-route-line";
const MARKER_SOURCE_ID = "video-route-markers";
const MARKER_CIRCLE_LAYER_ID = "video-route-marker-circles";
const MARKER_LABEL_LAYER_ID = "video-route-marker-labels";
const PROGRESS_SOURCE_ID = "video-route-progress";
const PROGRESS_LAYER_ID = "video-route-progress-point";
export const VIDEO_ROUTE_COLOR = "#d9ff57";
const VIDEO_ROUTE_FUTURE_COLOR = "rgba(217, 255, 87, 0.22)";
const DEFAULT_DURATION_SECONDS = 45;

const MAP_STYLES = {
  classic: "mapbox://styles/mapbox/satellite-streets-v12",
  standard: "mapbox://styles/mapbox/standard-satellite",
} as const;

type MapStyleChoice = keyof typeof MAP_STYLES;
type GeoJsonSourceData = Parameters<GeoJSONSource["setData"]>[0];

const initialSnapshot: AnimationPlaybackSnapshot = {
  currentTimeMs: 0,
  durationMs: DEFAULT_DURATION_SECONDS * 1_000,
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

export const buildRouteGradient = (
  mode: RouteRevealMode,
  progress: number,
): string | ExpressionSpecification => mode === "full"
  ? VIDEO_ROUTE_COLOR
  : [
      "step",
      ["line-progress"],
      VIDEO_ROUTE_COLOR,
      Math.min(1, Math.max(0, progress)),
      VIDEO_ROUTE_FUTURE_COLOR,
    ] as ExpressionSpecification;

export const buildProgressGeoJson = (point: PreparedRoutePoint) => ({
  type: "FeatureCollection" as const,
  features: [{
    type: "Feature" as const,
    properties: { kind: "progress", distanceKm: point.distanceKm },
    geometry: { type: "Point" as const, coordinates: [point.lon, point.lat] },
  }],
});

const syncMapData = (
  map: MapboxMap,
  routeData: ReturnType<typeof buildRouteGeoJson>,
  markerData: ReturnType<typeof buildMarkerGeoJson>,
  firstPoint: PreparedRoutePoint,
) => {
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
        "line-gradient": buildRouteGradient("progressive", 0),
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3, 13, 7],
        "line-opacity": 0.96,
        "line-emissive-strength": 1,
      },
    });
  }

  const progressData = buildProgressGeoJson(firstPoint);
  const progressSource = map.getSource(PROGRESS_SOURCE_ID) as GeoJSONSource | undefined;
  if (progressSource) progressSource.setData(progressData as GeoJsonSourceData);
  else map.addSource(PROGRESS_SOURCE_ID, { type: "geojson", data: progressData as GeoJsonSourceData });

  if (!map.getLayer(PROGRESS_LAYER_ID)) {
    map.addLayer({
      id: PROGRESS_LAYER_ID,
      type: "circle",
      source: PROGRESS_SOURCE_ID,
      slot: "top",
      paint: {
        "circle-radius": 8,
        "circle-color": VIDEO_ROUTE_COLOR,
        "circle-stroke-color": "#172012",
        "circle-stroke-width": 3,
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
        "circle-radius": ["match", ["get", "kind"], "aid", 6, 8],
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

export function VideoGeneratorMapClient({ aidStations, bounds, points, raceName }: VideoGeneratorMapProps) {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const cameraRef = useRef<RouteCameraController | null>(null);
  const animationRef = useRef<RouteAnimationController | null>(null);
  const resizeRef = useRef<MapResizeController | null>(null);
  const boundsRef = useRef(bounds);
  const pointsRef = useRef(points);
  const routeData = useMemo(() => buildRouteGeoJson(points), [points]);
  const markerData = useMemo(() => buildMarkerGeoJson(points, aidStations), [aidStations, points]);
  const initialPreparedPath = useMemo(() => prepareAnimationPath(points), [points]);
  const routeDataRef = useRef(routeData);
  const markerDataRef = useRef(markerData);
  const preparedPathRef = useRef<PreparedAnimationPath>(initialPreparedPath);
  const durationMsRef = useRef(DEFAULT_DURATION_SECONDS * 1_000);
  const viewportRef = useRef<AnimationViewport>("portrait");
  const revealModeRef = useRef<RouteRevealMode>("progressive");
  const styleLoadVersionRef = useRef(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [canAnimate, setCanAnimate] = useState(preparedPathRef.current.canAnimate);
  const [styleChoice, setStyleChoice] = useState<MapStyleChoice>("classic");
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [viewport, setViewport] = useState<AnimationViewport>("portrait");
  const [revealMode, setRevealMode] = useState<RouteRevealMode>("progressive");
  const [snapshot, setSnapshot] = useState<AnimationPlaybackSnapshot>(initialSnapshot);
  const [webGlAvailable] = useState(() => typeof document === "undefined" || supportsWebGl());

  const applyAnimationTime = useCallback((timeMs: number) => {
    const map = mapRef.current;
    const camera = cameraRef.current;
    const path = preparedPathRef.current;
    if (!map?.isStyleLoaded() || !camera || !path.canAnimate) return;
    const frame = getCameraStateAtTime(timeMs, durationMsRef.current, path, undefined, viewportRef.current);
    camera.applyAnimationFrame(frame);
    if (map.getLayer(ROUTE_LAYER_ID)) {
      map.setPaintProperty(ROUTE_LAYER_ID, "line-gradient", buildRouteGradient(revealModeRef.current, frame.progress));
    }
    const progressSource = map.getSource(PROGRESS_SOURCE_ID) as GeoJSONSource | undefined;
    progressSource?.setData(buildProgressGeoJson(frame.routePoint) as GeoJsonSourceData);
  }, []);

  useEffect(() => {
    boundsRef.current = bounds;
    pointsRef.current = points;
    routeDataRef.current = routeData;
    markerDataRef.current = markerData;
    preparedPathRef.current = initialPreparedPath;
    setCanAnimate(initialPreparedPath.canAnimate);
    animationRef.current?.pause();
    animationRef.current?.seek(0);
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncMapData(map, routeData, markerData, initialPreparedPath.samples[0]);
    cameraRef.current?.reset(500);
  }, [bounds, initialPreparedPath, markerData, points, routeData]);

  useEffect(() => {
    durationMsRef.current = durationSeconds * 1_000;
    animationRef.current?.setDuration(durationMsRef.current);
  }, [durationSeconds]);

  useEffect(() => {
    viewportRef.current = viewport;
    const controller = animationRef.current;
    window.requestAnimationFrame(() => {
      resizeRef.current?.schedule();
      if (controller) controller.seek(controller.getSnapshot().progress);
    });
  }, [viewport]);

  useEffect(() => {
    revealModeRef.current = revealMode;
    const controller = animationRef.current;
    if (controller) controller.seek(controller.getSnapshot().progress);
  }, [revealMode]);

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
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES.classic,
      center: [boundsRef.current.minLon, boundsRef.current.minLat],
      zoom: 9,
      pitch: 55,
      bearing: 0,
      projection: "mercator",
      antialias: true,
      attributionControl: true,
    });
    mapRef.current = map;
    cameraRef.current = createRouteCameraController(map, () => boundsRef.current);
    animationRef.current = createRouteAnimationController({
      durationMs: durationMsRef.current,
      onFrame: applyAnimationTime,
      onSnapshot: setSnapshot,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    const resizeController = observeMapSize(map, containerRef.current);
    resizeRef.current = resizeController;

    const handleStyleLoad = () => {
      styleLoadVersionRef.current += 1;
      const loadVersion = styleLoadVersionRef.current;
      setMapError(null);
      if (!map.getSource(TERRAIN_SOURCE_ID)) {
        map.addSource(TERRAIN_SOURCE_ID, { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 });
      }
      map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION });
      const fallbackPath = prepareAnimationPath(pointsRef.current);
      syncMapData(map, routeDataRef.current, markerDataRef.current, fallbackPath.samples[0]);
      resizeController.schedule();
      window.requestAnimationFrame(() => {
        if (mapRef.current !== map || loadVersion !== styleLoadVersionRef.current) return;
        cameraRef.current?.reset(0);
        map.once("idle", () => {
          if (mapRef.current !== map || loadVersion !== styleLoadVersionRef.current) return;
          const preparedPath = prepareAnimationPath(pointsRef.current, ({ lat, lon }) =>
            map.queryTerrainElevation([lon, lat], { exaggerated: false }));
          preparedPathRef.current = preparedPath;
          setCanAnimate(preparedPath.canAnimate);
          setIsReady(true);
          const controller = animationRef.current;
          if (controller) controller.seek(controller.getSnapshot().progress);
        });
      });
    };
    const handleError = (event: MapboxEvent & { error?: Error }) => {
      if (!event.error) return;
      console.error("Mapbox video generator error", event.error);
      setMapError("La carte 3D n’a pas pu être chargée. Vérifiez le token Mapbox et sa restriction de domaine.");
    };

    map.on("style.load", handleStyleLoad);
    map.on("error", handleError);
    return () => {
      map.off("style.load", handleStyleLoad);
      map.off("error", handleError);
      animationRef.current?.destroy();
      resizeController.destroy();
      map.remove();
      mapRef.current = null;
      cameraRef.current = null;
      animationRef.current = null;
      resizeRef.current = null;
    };
  }, [accessToken, applyAnimationTime, webGlAvailable]);

  if (!accessToken) {
    return <div className="flex min-h-[34rem] w-full items-center justify-center bg-muted p-8 text-center text-sm text-muted-foreground">Configurez <code className="mx-1 rounded bg-background px-1.5 py-0.5">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> pour charger le terrain 3D.</div>;
  }
  if (!webGlAvailable) {
    return <div className="flex min-h-[34rem] w-full items-center justify-center bg-muted p-8 text-center text-sm text-muted-foreground">WebGL n’est pas disponible dans ce navigateur. Activez l’accélération graphique ou utilisez un navigateur compatible.</div>;
  }

  const selectStyle = (nextStyle: MapStyleChoice) => {
    if (nextStyle === styleChoice) return;
    animationRef.current?.pause();
    setStyleChoice(nextStyle);
    setIsReady(false);
    setMapError(null);
    mapRef.current?.setStyle(MAP_STYLES[nextStyle]);
  };
  const previewLabel = viewport === "portrait" ? "Aperçu Instagram 9:16" : "Aperçu classique 16:9";
  const previewDimensions = viewport === "portrait" ? "1080 × 1920" : "1920 × 1080";

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="mr-auto text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-[0.16em]">{previewLabel}</span>
          <span className="ml-2 tabular-nums">{previewDimensions}</span>
        </div>
        <Button type="button" variant="outline" disabled={!isReady || snapshot.isPlaying} onClick={() => cameraRef.current?.fitOverview()}>Vue d’ensemble</Button>
        <Button type="button" variant="outline" disabled={!isReady || snapshot.isPlaying} onClick={() => cameraRef.current?.reset()}>Réinitialiser la caméra</Button>
        <div className="flex rounded-md border border-border bg-card p-1">
          <Button type="button" className="px-2 text-xs" variant={styleChoice === "classic" ? "default" : "ghost"} onClick={() => selectStyle("classic")}>Satellite stable</Button>
          <Button type="button" className="px-2 text-xs" variant={styleChoice === "standard" ? "default" : "ghost"} onClick={() => selectStyle("standard")}>Standard 3D</Button>
        </div>
      </div>

      <div className={viewport === "portrait"
        ? "mx-auto aspect-[9/16] w-full max-w-md overflow-hidden rounded-[1.5rem] border-4 border-slate-900 bg-slate-950 shadow-2xl"
        : "mx-auto aspect-video w-full max-w-5xl overflow-hidden rounded-xl border-4 border-slate-900 bg-slate-950 shadow-2xl"}>
        <div className="relative h-full w-full bg-slate-950">
          {/* Mapbox CSS sets `.mapboxgl-map { position: relative }`, which overrides `absolute` on the
              container itself. The wrapper owns positioning so the production canvas cannot collapse. */}
          <div className={`absolute inset-0 ${snapshot.isPlaying ? "pointer-events-none" : ""}`}>
            <div ref={containerRef} className="h-full w-full" aria-label="Visualiseur 3D animé du parcours" />
          </div>
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 max-w-[68%] rounded-lg bg-slate-950/75 p-3 text-white shadow-lg backdrop-blur-sm">
            <p className="truncate text-sm font-semibold">{raceName}</p>
            <p className="mt-1 text-xs tabular-nums text-white/80">{Math.round(snapshot.progress * 100)} % · {(preparedPathRef.current.totalDistanceKm * snapshot.progress).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km</p>
          </div>
          {viewport === "portrait" ? (
            <div className="pointer-events-none absolute inset-x-3 bottom-8 z-10 flex h-[17%] items-end justify-center rounded-lg border border-dashed border-white/20 bg-gradient-to-t from-slate-950/55 to-transparent pb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">Zone réservée au profil altimétrique</div>
          ) : null}
          {!isReady && !mapError ? <div className="pointer-events-none absolute inset-x-4 bottom-10 z-20 rounded-md bg-slate-950/80 p-3 text-center text-sm text-white/80">Préparation du terrain et de la caméra…</div> : null}
          {mapError ? <div className="absolute inset-x-4 bottom-10 z-20 rounded-md border border-red-300 bg-red-50/95 p-3 text-sm text-red-800 shadow-lg">{mapError}</div> : null}
        </div>
      </div>

      <AnimationControls
        canAnimate={canAnimate}
        durationSeconds={durationSeconds}
        isReady={isReady}
        onDurationChange={setDurationSeconds}
        onPause={() => animationRef.current?.pause()}
        onPlay={() => animationRef.current?.play()}
        onRestart={() => animationRef.current?.restart()}
        onRevealModeChange={setRevealMode}
        onSeek={(progress) => animationRef.current?.seek(progress)}
        onViewportChange={setViewport}
        revealMode={revealMode}
        snapshot={snapshot}
        totalDistanceKm={preparedPathRef.current.totalDistanceKm}
        viewport={viewport}
      />
    </div>
  );
}
