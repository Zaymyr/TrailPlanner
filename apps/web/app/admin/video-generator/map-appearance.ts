import type { ExpressionSpecification, FogSpecification, Map as MapboxMap } from "mapbox-gl";

import type { VideoCompositionSettings } from "./video-composition";

export const MAP_STYLES = {
  classic: "mapbox://styles/mapbox/satellite-streets-v12",
  standard: "mapbox://styles/mapbox/standard-satellite",
} as const;

export const resolveMapStyleUrl = (settings: Pick<VideoCompositionSettings, "mapStyle" | "customStyleUrl">) =>
  settings.mapStyle === "custom" && settings.customStyleUrl ? settings.customStyleUrl : MAP_STYLES[settings.mapStyle === "standard" ? "standard" : "classic"];

type Ambiance = {
  label: string;
  raster: { saturation: number; contrast: number; brightnessMin: number; brightnessMax: number };
  fog: FogSpecification;
};

export const MAP_AMBIANCES: Record<VideoCompositionSettings["mapAmbiance"], Ambiance> = {
  natural: {
    label: "Naturel",
    raster: { saturation: 0, contrast: 0, brightnessMin: 0, brightnessMax: 1 },
    fog: { color: "#dce6f0", "high-color": "#6aa0d8", "horizon-blend": 0.08, "space-color": "#0b1a33", "star-intensity": 0 },
  },
  vivid: {
    label: "Éclatant",
    raster: { saturation: 0.3, contrast: 0.18, brightnessMin: 0.02, brightnessMax: 1 },
    fog: { color: "#e8f1ff", "high-color": "#3b82f6", "horizon-blend": 0.06, "space-color": "#0b1a33", "star-intensity": 0 },
  },
  cinematic: {
    label: "Cinéma",
    raster: { saturation: -0.35, contrast: 0.28, brightnessMin: 0.05, brightnessMax: 0.88 },
    fog: { color: "#f3d9b1", "high-color": "#8a5a3c", "horizon-blend": 0.12, "space-color": "#1c1410", "star-intensity": 0 },
  },
  night: {
    label: "Nocturne",
    raster: { saturation: -0.55, contrast: 0.2, brightnessMin: 0, brightnessMax: 0.55 },
    fog: { color: "#1e2a44", "high-color": "#0b1020", "horizon-blend": 0.15, "space-color": "#02040a", "star-intensity": 0.6 },
  },
};

export const ROUTE_LINE_WIDTHS: Record<VideoCompositionSettings["routeWidth"], ExpressionSpecification> = {
  normal: ["interpolate", ["linear"], ["zoom"], 5, 3, 13, 7],
  bold: ["interpolate", ["linear"], ["zoom"], 5, 5, 13, 11],
};

export const ROUTE_GLOW_WIDTH: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 5, 10, 13, 26];

// Mapbox Standard exposes its labels through configuration instead of style layers.
const STANDARD_LABEL_CONFIG = ["showPlaceLabels", "showRoadLabels", "showPointOfInterestLabels", "showTransitLabels"];

export type MapAppearanceState = {
  /** Basemap symbol layers that were visible when the style loaded; only these are toggled. */
  basemapSymbolLayerIds: string[];
};

export const captureMapAppearanceState = (map: MapboxMap, ownLayerIds: Set<string>): MapAppearanceState => ({
  basemapSymbolLayerIds: (map.getStyle()?.layers ?? [])
    .filter((layer) => layer.type === "symbol" && !ownLayerIds.has(layer.id) && layer.layout?.visibility !== "none")
    .map((layer) => layer.id),
});

/** Applies the basemap look. Called on style load and when an appearance setting changes, never per frame. */
export const applyMapAppearance = (
  map: MapboxMap,
  settings: VideoCompositionSettings,
  state: MapAppearanceState,
  ownLayerIds: Set<string>,
) => {
  const ambiance = MAP_AMBIANCES[settings.mapAmbiance];
  (map.getStyle()?.layers ?? []).forEach((layer) => {
    if (layer.type !== "raster" || ownLayerIds.has(layer.id)) return;
    map.setPaintProperty(layer.id, "raster-saturation", ambiance.raster.saturation);
    map.setPaintProperty(layer.id, "raster-contrast", ambiance.raster.contrast);
    map.setPaintProperty(layer.id, "raster-brightness-min", ambiance.raster.brightnessMin);
    map.setPaintProperty(layer.id, "raster-brightness-max", ambiance.raster.brightnessMax);
  });
  state.basemapSymbolLayerIds.forEach((layerId) => {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", settings.hideMapLabels ? "none" : "visible");
  });
  if (settings.mapStyle === "standard") {
    STANDARD_LABEL_CONFIG.forEach((property) => {
      try {
        map.setConfigProperty("basemap", property, !settings.hideMapLabels);
      } catch {
        // Older Standard revisions may not expose every label group.
      }
    });
  }
  map.setFog(ambiance.fog);
};
