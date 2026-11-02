"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, {
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapboxEvent,
} from "mapbox-gl";

import { Button } from "../../../components/ui/button";
import { buildMarkerGeoJson, buildRouteGeoJson } from "../../../lib/video-generator";
import { createRouteCameraController, type RouteCameraController } from "./camera-controller";
import { observeMapSize } from "./map-resize-controller";
import type { VideoGeneratorMapProps } from "./VideoGeneratorMap";

const TERRAIN_SOURCE_ID = "video-terrain-dem";
const ROUTE_SOURCE_ID = "video-route";
const ROUTE_LAYER_ID = "video-route-line";
const MARKER_SOURCE_ID = "video-route-markers";
const MARKER_CIRCLE_LAYER_ID = "video-route-marker-circles";
const MARKER_LABEL_LAYER_ID = "video-route-marker-labels";
export const VIDEO_ROUTE_COLOR = "#d9ff57";

const supportsWebGl = () => {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
};

type GeoJsonSourceData = Parameters<GeoJSONSource["setData"]>[0];

const syncMapData = (
  map: MapboxMap,
  routeData: ReturnType<typeof buildRouteGeoJson>,
  markerData: ReturnType<typeof buildMarkerGeoJson>,
) => {
  const routeSource = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
  if (routeSource) routeSource.setData(routeData as GeoJsonSourceData);
  else map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: routeData as GeoJsonSourceData });

  if (!map.getLayer(ROUTE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": VIDEO_ROUTE_COLOR,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3, 13, 7],
        "line-opacity": 0.96,
        "line-emissive-strength": 1,
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
        "circle-color": [
          "match",
          ["get", "kind"],
          "start",
          "#22c55e",
          "finish",
          "#e11d48",
          "#f59e0b",
        ],
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
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "#172012",
        "text-halo-width": 1.5,
      },
    });
  }
};

export function VideoGeneratorMapClient({ aidStations, bounds, points }: VideoGeneratorMapProps) {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const cameraRef = useRef<RouteCameraController | null>(null);
  const boundsRef = useRef(bounds);
  const routeData = useMemo(() => buildRouteGeoJson(points), [points]);
  const markerData = useMemo(() => buildMarkerGeoJson(points, aidStations), [aidStations, points]);
  const routeDataRef = useRef(routeData);
  const markerDataRef = useRef(markerData);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [webGlAvailable] = useState(() => typeof document === "undefined" || supportsWebGl());

  useEffect(() => {
    boundsRef.current = bounds;
    routeDataRef.current = routeData;
    markerDataRef.current = markerData;

    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncMapData(map, routeData, markerData);
    cameraRef.current?.reset(500);
  }, [bounds, markerData, routeData]);

  useEffect(() => {
    if (!accessToken || !webGlAvailable || !containerRef.current) return;

    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard-satellite",
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
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    const resizeController = observeMapSize(map, containerRef.current);

    const handleStyleLoad = () => {
      if (!map.getSource(TERRAIN_SOURCE_ID)) {
        map.addSource(TERRAIN_SOURCE_ID, {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.15 });
      syncMapData(map, routeDataRef.current, markerDataRef.current);
      resizeController.schedule();
      window.requestAnimationFrame(() => {
        if (mapRef.current !== map) return;
        cameraRef.current?.reset(0);
        setIsReady(true);
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
      resizeController.destroy();
      map.remove();
      mapRef.current = null;
      cameraRef.current = null;
    };
  }, [accessToken, webGlAvailable]);

  if (!accessToken) {
    return (
      <div className="flex h-full min-h-[34rem] items-center justify-center bg-muted p-8 text-center text-sm text-muted-foreground">
        Configurez <code className="mx-1 rounded bg-background px-1.5 py-0.5">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>
        pour charger le terrain 3D.
      </div>
    );
  }

  if (!webGlAvailable) {
    return (
      <div className="flex h-full min-h-[34rem] items-center justify-center bg-muted p-8 text-center text-sm text-muted-foreground">
        WebGL n’est pas disponible dans ce navigateur. Activez l’accélération graphique ou utilisez un navigateur compatible.
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[34rem] w-full bg-slate-950">
      <div ref={containerRef} className="absolute inset-0" aria-label="Visualiseur 3D du parcours" />
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="pointer-events-auto bg-card/95 shadow-lg backdrop-blur"
          disabled={!isReady}
          onClick={() => cameraRef.current?.fitOverview()}
        >
          Vue d’ensemble
        </Button>
        <Button
          type="button"
          variant="outline"
          className="pointer-events-auto bg-card/95 shadow-lg backdrop-blur"
          disabled={!isReady}
          onClick={() => cameraRef.current?.reset()}
        >
          Réinitialiser la caméra
        </Button>
      </div>
      {mapError ? (
        <div className="absolute inset-x-4 bottom-8 z-10 rounded-md border border-red-300 bg-red-50/95 p-3 text-sm text-red-800 shadow-lg">
          {mapError}
        </div>
      ) : null}
    </div>
  );
}
