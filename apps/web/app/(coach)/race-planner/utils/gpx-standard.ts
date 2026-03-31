import type { RacePlannerTranslations } from "../../../../locales/types";
import type { AidStation, ElevationPoint, FormValues } from "../types";
import { dedupeAidStations, sanitizeAidStations, sanitizeElevationProfile } from "./plan-sanitizers";
import { parseGpx as parseSharedGpx } from "../../../../lib/gpx/parseGpx";
import { normalizeImportedWaypoints } from "../../../../lib/gpx/normalizeImportedWaypoints";

export type ParsedGpx = {
  distanceKm: number;
  aidStations: AidStation[];
  elevationProfile: ElevationPoint[];
  plannerValues?: Partial<FormValues>;
  startName?: string;
  finishName?: string;
};

type ParsedTrackPoint = { lat: number; lon: number; distanceMeters: number; elevationM: number };

type ParsedWaypoint = {
  lat: number;
  lon: number;
  name: string;
  index?: number;
  distanceMeters?: number;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const toNumber = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const escapeXml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return char;
    }
  });

const decodeEntities = (text: string | null | undefined) => {
  if (!text) return "";
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
};

const parseAttr = (attributes: string, key: "lat" | "lon") =>
  toNumber(attributes.match(new RegExp(`\\b${key}=\"([^\"]+)\"`, "i"))?.[1] ?? attributes.match(new RegExp(`\\b${key}='([^']+)'`, "i"))?.[1]);

const parseTag = (inner: string, tag: string) => decodeEntities(inner.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]);

const parseExtensionNumber = (inner: string, localName: string): number | undefined => {
  const regex = new RegExp(`<[^:>]+:${localName}>([\\s\\S]*?)<\\/[^:>]+:${localName}>`, "i");
  const parsed = toNumber(inner.match(regex)?.[1]);
  return parsed === null ? undefined : parsed;
};

export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMeters = 6371e3;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dPhi = toRadians(lat2 - lat1);
  const dLambda = toRadians(lon2 - lon1);

  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

const parseWaypoints = (content: string, copy: RacePlannerTranslations): ParsedWaypoint[] => {
  const wptRegex = /<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/gi;
  const waypoints: ParsedWaypoint[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = wptRegex.exec(content))) {
    const lat = parseAttr(match[1], "lat");
    const lon = parseAttr(match[1], "lon");

    if (lat === null || lon === null) continue;

    const inner = match[2];
    const name = parseTag(inner, "name") || parseTag(inner, "desc") || copy.gpx.fallbackAidStation;
    const extensionIndex = parseExtensionNumber(inner, "index");
    const extensionDistance = parseExtensionNumber(inner, "distance");

    waypoints.push({
      lat,
      lon,
      name,
      ...(extensionIndex !== undefined ? { index: extensionIndex } : {}),
      ...(extensionDistance !== undefined ? { distanceMeters: extensionDistance } : {}),
    });
  }

  return waypoints;
};

const findClosestTrackPoint = (waypoint: ParsedWaypoint, trackPoints: ParsedTrackPoint[]) => {
  let closest = trackPoints[0];
  let minDistance = Number.POSITIVE_INFINITY;

  for (const point of trackPoints) {
    const meters = haversineDistanceMeters(waypoint.lat, waypoint.lon, point.lat, point.lon);
    if (meters < minDistance) {
      minDistance = meters;
      closest = point;
    }
  }

  return closest;
};

export function parseStandardGpx(content: string, copy: RacePlannerTranslations): ParsedGpx {
  const shared = parseSharedGpx(content);
  const trackPoints: ParsedTrackPoint[] = shared.points.map((point) => ({
    lat: point.lat,
    lon: point.lng,
    distanceMeters: point.distKmCum * 1000,
    elevationM: point.ele ?? 0,
  }));

  if (trackPoints.length === 0) {
    throw new Error(copy.gpx.errors.noTrackPoints);
  }

  const waypoints = parseWaypoints(content, copy);

  const mappedWaypoints = waypoints
    .map((waypoint, index) => {
      const distanceMeters = waypoint.distanceMeters ?? findClosestTrackPoint(waypoint, trackPoints).distanceMeters;
      return {
        lat: waypoint.lat,
        lng: waypoint.lon,
        name: waypoint.name,
        desc: waypoint.name,
        distanceKm: Number((distanceMeters / 1000).toFixed(1)),
        __order: Number.isFinite(waypoint.index) ? Number(waypoint.index) : index,
      };
    })
    .sort((a, b) => a.__order - b.__order || a.distanceKm - b.distanceKm)
    .map(({ __order: _order, ...station }) => station);

  const normalizedWaypoints = normalizeImportedWaypoints(
    trackPoints.map((point) => ({
      lat: point.lat,
      lng: point.lon,
      ele: point.elevationM,
      distKmCum: Number((point.distanceMeters / 1000).toFixed(3)),
    })),
    mappedWaypoints
  );

  const totalDistanceKm = Number(((trackPoints.at(-1)?.distanceMeters ?? 0) / 1000).toFixed(1));
  const aidStations: AidStation[] = [
    ...normalizedWaypoints.aidStations.map((station) => ({ name: station.name, distanceKm: station.distanceKm })),
    {
      name: normalizedWaypoints.finishName || copy.defaults.finish,
      distanceKm: totalDistanceKm,
      waterRefill: true,
    },
  ];

  const elevationProfile = sanitizeElevationProfile(
    trackPoints.map((point) => ({
      distanceKm: Number((point.distanceMeters / 1000).toFixed(3)),
      elevationM: Number(point.elevationM.toFixed(1)),
      lat: point.lat,
      lon: point.lon,
    }))
  );

  return {
    distanceKm: totalDistanceKm,
    aidStations: dedupeAidStations(aidStations),
    elevationProfile,
    startName: normalizedWaypoints.startName || copy.defaults.start,
    finishName: normalizedWaypoints.finishName || copy.defaults.finish,
  };
}

const normalizeTrackCoordinates = (profile: ElevationPoint[]) => {
  const valid = profile.filter((point): point is ElevationPoint & { lat: number; lon: number } =>
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lon) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180
  );

  if (valid.length === 0) {
    return profile.map((point, index) => ({
      ...point,
      lat: 45 + index * 0.0001,
      lon: 3,
    }));
  }

  const first = valid[0];
  return profile.map((point) => ({
    ...point,
    lat: typeof point.lat === "number" && Number.isFinite(point.lat) ? point.lat : first.lat,
    lon: typeof point.lon === "number" && Number.isFinite(point.lon) ? point.lon : first.lon,
  }));
};

export function buildStandardPlannerGpx(values: FormValues, elevationProfile: ElevationPoint[]) {
  const safeAidStations = sanitizeAidStations(values.aidStations);
  const distanceKm = Number.isFinite(values.raceDistanceKm) ? values.raceDistanceKm : 0;
  const safeProfile = sanitizeElevationProfile(elevationProfile);
  const profile = safeProfile.length > 0 ? safeProfile : [{ distanceKm: Number(distanceKm.toFixed(3)), elevationM: 0 }];
  const trackWithCoordinates = normalizeTrackCoordinates(profile);

  const aidStationsXml = safeAidStations
    .map((station, index) => {
      const matchingTrackPoint =
        trackWithCoordinates.find((point) => point.distanceKm >= station.distanceKm) ??
        trackWithCoordinates[trackWithCoordinates.length - 1];

      return `  <wpt lat="${matchingTrackPoint.lat.toFixed(6)}" lon="${matchingTrackPoint.lon.toFixed(6)}">\n    <name>${escapeXml(
        station.name
      )}</name>\n    <extensions>\n      <tp:index>${index}</tp:index>\n      <tp:distance>${Math.round(
        station.distanceKm * 1000
      )}</tp:distance>\n    </extensions>\n  </wpt>`;
    })
    .join("\n");

  const trackSegment = trackWithCoordinates
    .map(
      (point) =>
        `      <trkpt lat="${point.lat.toFixed(6)}" lon="${point.lon.toFixed(6)}">\n        <ele>${point.elevationM.toFixed(
          1
        )}</ele>\n      </trkpt>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Pace Yourself" xmlns="http://www.topografix.com/GPX/1/1" xmlns:tp="https://pace-yourself.app/gpx">
  <metadata>
    <link href="https://trailplanner.app">
      <text>Pace Yourself</text>
    </link>
    <time>${new Date().toISOString()}</time>
  </metadata>
${aidStationsXml}
  <trk>
    <name>${escapeXml(`${distanceKm.toFixed(1)} km plan`)}</name>
    <trkseg>
${trackSegment}
    </trkseg>
  </trk>
</gpx>`;
}
