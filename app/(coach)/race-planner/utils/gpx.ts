import type { RacePlannerTranslations } from "../../../../locales/types";
import type { AidStation, ElevationPoint, FormValues } from "../types";
import {
  dedupeAidStations,
  sanitizeAidStations,
  sanitizeElevationProfile,
  sanitizePlannerValues,
  sanitizeSectionSegments,
  sanitizeSegmentPlan,
} from "./plan-sanitizers";

export type ParsedGpx = {
  distanceKm: number;
  aidStations: AidStation[];
  elevationProfile: ElevationPoint[];
  plannerValues?: Partial<FormValues>;
};

type PlannerStatePayload = {
  version?: number;
  values?: Partial<FormValues>;
  elevationProfile?: ElevationPoint[];
};

export function decodePlannerState(xml: Document): { state: PlannerStatePayload | null; invalid: boolean } {
  const stateNode =
    xml.getElementsByTagName("trailplanner:state")[0] ?? xml.getElementsByTagName("plannerState")[0];
  const encoded = stateNode?.textContent?.trim();

  if (!encoded) {
    return { state: null, invalid: false };
  }

  try {
    const decodedJson = decodeURIComponent(escape(atob(encoded)));
    const payload = JSON.parse(decodedJson) as PlannerStatePayload;
    return { state: payload, invalid: false };
  } catch (error) {
    console.error("Unable to parse planner state from GPX", error);
    return { state: null, invalid: true };
  }
}

export function encodePlannerState(values: FormValues, elevationProfile: ElevationPoint[]): string {
  const payload: PlannerStatePayload = {
    version: 1,
    values,
    elevationProfile,
  };

  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
}

export function buildFlatElevationProfile(distanceKm: number): ElevationPoint[] {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return [];

  return [
    { distanceKm: 0, elevationM: 0 },
    { distanceKm: Number(distanceKm.toFixed(2)), elevationM: 0 },
  ];
}

export function buildPlannerGpx(values: FormValues, elevationProfile: ElevationPoint[]) {
  const safeAidStations = sanitizeAidStations(values.aidStations);
  const safeFinishPlan = sanitizeSegmentPlan(values.finishPlan);
  const distanceKm = Number.isFinite(values.raceDistanceKm) ? values.raceDistanceKm : 0;
  const profile = elevationProfile.length > 0 ? elevationProfile : buildFlatElevationProfile(distanceKm);
  const safeSectionSegments = sanitizeSectionSegments(values.sectionSegments);
  const plannerState = encodePlannerState(
    { ...values, aidStations: safeAidStations, finishPlan: safeFinishPlan, sectionSegments: safeSectionSegments },
    profile
  );

  const escapeXml = (text: string) => text.replace(/[&<>"']/g, (char) => {
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

  const toPseudoCoordinates = (km: number) => ({ lat: 0, lon: km / 111 });

  const aidStationsXml = safeAidStations
    .map((station, index) => {
      const coord = toPseudoCoordinates(station.distanceKm);
      return `    <wpt lat="${coord.lat.toFixed(6)}" lon="${coord.lon.toFixed(6)}">\n      <name>${escapeXml(
        station.name
      )}</name>\n      <extensions>\n        <trailplanner:index>${index}</trailplanner:index>\n      </extensions>\n    </wpt>`;
    })
    .join("\n");

  const trackSegment = profile
    .map((point) => {
      const coord = toPseudoCoordinates(point.distanceKm);
      return `      <trkpt lat="${coord.lat.toFixed(6)}" lon="${coord.lon.toFixed(6)}">\n        <ele>${point.elevationM.toFixed(
        1
      )}</ele>\n        <extensions>\n          <trailplanner:distanceKm>${point.distanceKm.toFixed(3)}</trailplanner:distanceKm>\n        </extensions>\n      </trkpt>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Pace Yourself" xmlns="http://www.topografix.com/GPX/1/1" xmlns:trailplanner="https://trailplanner.app/gpx">
  <metadata>
    <link href="https://trailplanner.app">
      <text>Pace Yourself</text>
    </link>
    <time>${new Date().toISOString()}</time>
    <extensions>
      <trailplanner:state>${plannerState}</trailplanner:state>
    </extensions>
  </metadata>
  ${aidStationsXml}
  ${profile.length ? `<trk>\n    <name>${escapeXml(`${distanceKm.toFixed(1)} km plan`)}</name>\n    <trkseg>\n${trackSegment}\n    </trkseg>\n  </trk>` : ""}
</gpx>`;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function parseGpx(content: string, copy: RacePlannerTranslations): ParsedGpx {
  const parser = new DOMParser();
  const xml = parser.parseFromString(content, "text/xml");
  const { state: plannerState, invalid } = decodePlannerState(xml);
  if (invalid) {
    throw new Error(copy.gpx.errors.invalidPlannerState);
  }

  const trkpts = Array.from(xml.getElementsByTagName("trkpt"));

  let parsedTrack: Omit<ParsedGpx, "plannerValues"> | null = null;
  if (trkpts.length > 0) {
    const cumulativeTrack: { lat: number; lon: number; distance: number; elevation: number }[] = [];
    trkpts.forEach((pt, index) => {
      const lat = parseFloat(pt.getAttribute("lat") ?? "");
      const lon = parseFloat(pt.getAttribute("lon") ?? "");
      const elevation = parseFloat(pt.getElementsByTagName("ele")[0]?.textContent ?? "0");
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        throw new Error(copy.gpx.errors.invalidCoordinates);
      }

      if (index === 0) {
        cumulativeTrack.push({ lat, lon, distance: 0, elevation: Number.isFinite(elevation) ? elevation : 0 });
        return;
      }

      const prev = cumulativeTrack[index - 1];
      const distance = haversineDistanceMeters(prev.lat, prev.lon, lat, lon);
      cumulativeTrack.push({
        lat,
        lon,
        distance: prev.distance + distance,
        elevation: Number.isFinite(elevation) ? elevation : prev.elevation,
      });
    });

    const totalMeters = cumulativeTrack.at(-1)?.distance ?? 0;
    const wpts = Array.from(xml.getElementsByTagName("wpt"));

    const aidStations = wpts
      .map((wpt) => {
        const lat = parseFloat(wpt.getAttribute("lat") ?? "");
        const lon = parseFloat(wpt.getAttribute("lon") ?? "");
        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          return null;
        }

        let closest = cumulativeTrack[0];
        let minDistance = Infinity;

        cumulativeTrack.forEach((point) => {
          const d = haversineDistanceMeters(lat, lon, point.lat, point.lon);
          if (d < minDistance) {
            minDistance = d;
            closest = point;
          }
        });

        const name =
          wpt.getElementsByTagName("name")[0]?.textContent?.trim() ||
          wpt.getElementsByTagName("desc")[0]?.textContent?.trim() ||
          copy.gpx.fallbackAidStation;

        return { name, distanceKm: Number(((closest?.distance ?? 0) / 1000).toFixed(1)) };
      })
      .filter(Boolean) as ParsedGpx["aidStations"];

    aidStations.push({ name: copy.defaults.finish, distanceKm: Number((totalMeters / 1000).toFixed(1)), waterRefill: true });

    const elevationProfile: ElevationPoint[] = cumulativeTrack.map((point) => ({
      distanceKm: Number((point.distance / 1000).toFixed(2)),
      elevationM: Number(point.elevation.toFixed(1)),
    }));

    parsedTrack = {
      distanceKm: Number((totalMeters / 1000).toFixed(1)),
      aidStations: dedupeAidStations(aidStations),
      elevationProfile,
    };
  }

  if (!parsedTrack && !plannerState) {
    throw new Error(copy.gpx.errors.noTrackPoints);
  }

  const sanitizedPlannerValues = sanitizePlannerValues(plannerState?.values);
  const profileFromState = sanitizeElevationProfile(plannerState?.elevationProfile);
  const elevationProfile = profileFromState.length > 0 ? profileFromState : parsedTrack?.elevationProfile ?? [];
  const distanceFromProfile = elevationProfile.at(-1)?.distanceKm;
  const baseDistance =
    sanitizedPlannerValues?.raceDistanceKm ?? parsedTrack?.distanceKm ?? (distanceFromProfile ?? 0) ?? 0;

  const aidStationsFromState = sanitizedPlannerValues?.aidStations ?? [];
  const baseAidStations = aidStationsFromState.length > 0 ? aidStationsFromState : parsedTrack?.aidStations ?? [];

  const aidStationsWithFinish = dedupeAidStations([
    ...baseAidStations,
    { name: copy.defaults.finish, distanceKm: Number(baseDistance.toFixed(1)), waterRefill: true },
  ]);

  return {
    distanceKm: Number(baseDistance.toFixed(1)),
    aidStations: aidStationsWithFinish,
    elevationProfile,
    plannerValues: sanitizedPlannerValues,
  };
}
