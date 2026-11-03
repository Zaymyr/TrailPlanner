import { z } from "zod";

export const videoRoutePointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  elevationM: z.number().nullable(),
  distanceKm: z.number().nonnegative(),
});

export const videoAidStationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  distanceKm: z.number().nonnegative(),
});

export const videoRaceSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid().nullable(),
  eventName: z.string().nullable(),
  name: z.string(),
  distanceKm: z.number(),
  elevationGainM: z.number().nullable(),
  elevationLossM: z.number().nullable(),
  editionYear: z.number().int().nullable().optional(),
});

export const videoRouteBoundsSchema = z.object({
  minLat: z.number(),
  minLon: z.number(),
  maxLat: z.number(),
  maxLon: z.number(),
});

export const videoGeneratorDetailSchema = z.object({
  race: videoRaceSchema,
  aidStations: z.array(videoAidStationSchema),
  gpx: z.discriminatedUnion("status", [
    z.object({ status: z.literal("missing") }),
    z.object({
      status: z.literal("ready"),
      pointCount: z.number().int().positive(),
      bounds: videoRouteBoundsSchema,
      points: z.array(videoRoutePointSchema).min(1),
    }),
  ]),
});

export type VideoRoutePoint = z.infer<typeof videoRoutePointSchema>;
export type VideoAidStation = z.infer<typeof videoAidStationSchema>;
export type VideoRouteBounds = z.infer<typeof videoRouteBoundsSchema>;
export type VideoGeneratorDetail = z.infer<typeof videoGeneratorDetailSchema>;

type GeoJsonPointGeometry = {
  type: "Point";
  coordinates: [number, number];
};

type GeoJsonLineGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

type GeoJsonFeature<TGeometry, TProperties> = {
  type: "Feature";
  geometry: TGeometry;
  properties: TProperties;
};

export type VideoRouteGeoJson = {
  type: "FeatureCollection";
  features: Array<GeoJsonFeature<GeoJsonLineGeometry, { kind: "route" }>>;
};

export type VideoMarkerKind = "start" | "finish" | "aid";

export type VideoMarkerGeoJson = {
  type: "FeatureCollection";
  features: Array<
    GeoJsonFeature<
      GeoJsonPointGeometry,
      { kind: VideoMarkerKind; label: string; distanceKm: number }
    >
  >;
};

export const buildRouteGeoJson = (points: VideoRoutePoint[]): VideoRouteGeoJson => ({
  type: "FeatureCollection",
  features: points.length === 0
    ? []
    : [
        {
          type: "Feature",
          properties: { kind: "route" },
          geometry: {
            type: "LineString",
            coordinates: points.map((point) => [point.lon, point.lat]),
          },
        },
      ],
});

export const findClosestRoutePoint = (
  points: VideoRoutePoint[],
  distanceKm: number,
): VideoRoutePoint | null => {
  if (points.length === 0) return null;
  if (distanceKm <= points[0].distanceKm) return points[0];

  const lastPoint = points[points.length - 1];
  if (distanceKm >= lastPoint.distanceKm) return lastPoint;

  let low = 0;
  let high = points.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const middleDistance = points[middle].distanceKm;
    if (middleDistance === distanceKm) return points[middle];
    if (middleDistance < distanceKm) low = middle + 1;
    else high = middle - 1;
  }

  const before = points[Math.max(0, high)];
  const after = points[Math.min(points.length - 1, low)];
  return distanceKm - before.distanceKm <= after.distanceKm - distanceKm ? before : after;
};

export const buildMarkerGeoJson = (
  points: VideoRoutePoint[],
  aidStations: VideoAidStation[],
): VideoMarkerGeoJson => {
  if (points.length === 0) return { type: "FeatureCollection", features: [] };

  const pointFeature = (
    point: VideoRoutePoint,
    kind: VideoMarkerKind,
    label: string,
    distanceKm = point.distanceKm,
  ): VideoMarkerGeoJson["features"][number] => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [point.lon, point.lat] },
    properties: { kind, label, distanceKm },
  });

  const features: VideoMarkerGeoJson["features"] = [pointFeature(points[0], "start", "Départ")];
  const finish = points[points.length - 1];
  features.push(pointFeature(finish, "finish", "Arrivée"));

  aidStations.forEach((station) => {
    const point = findClosestRoutePoint(points, station.distanceKm);
    if (point) features.push(pointFeature(point, "aid", station.name, station.distanceKm));
  });

  return { type: "FeatureCollection", features };
};
