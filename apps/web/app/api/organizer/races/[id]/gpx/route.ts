import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseGpx } from "../../../../../../lib/gpx/parseGpx";
import { normalizeImportedWaypoints } from "../../../../../../lib/gpx/normalizeImportedWaypoints";
import {
  jsonError,
  loadRaceForOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";
import { withSecurityHeaders } from "../../../../../../lib/http";

type ParsedOrganizerGpx = ReturnType<typeof parseGpx>;

const raceGpxPathSchema = z.object({
  id: z.string().uuid(),
  gpx_storage_path: z.string().nullable().optional(),
});

const stationIdSchema = z.object({ id: z.string().uuid() });

const toElevationProfile = (parsedGpx: ParsedOrganizerGpx, maxPoints = 600) => {
  if (parsedGpx.points.length === 0) return [];

  const step = Math.max(1, Math.ceil(parsedGpx.points.length / maxPoints));
  const profile = parsedGpx.points
    .filter((point, index) => index === 0 || index === parsedGpx.points.length - 1 || index % step === 0)
    .map((point) => ({
      distanceKm: point.distKmCum,
      elevationM: point.ele ?? 0,
      lat: point.lat,
      lon: point.lng,
    }));

  const lastPoint = parsedGpx.points[parsedGpx.points.length - 1];
  const lastProfilePoint = profile[profile.length - 1];
  if (lastPoint && lastProfilePoint?.distanceKm !== lastPoint.distKmCum) {
    profile.push({
      distanceKm: lastPoint.distKmCum,
      elevationM: lastPoint.ele ?? 0,
      lat: lastPoint.lat,
      lon: lastPoint.lng,
    });
  }

  return profile;
};

const toDetectedAidStations = (parsedGpx: ParsedOrganizerGpx) =>
  parsedGpx.pointSource !== "waypoint" && parsedGpx.waypoints.length > 0
    ? normalizeImportedWaypoints(parsedGpx.points, parsedGpx.waypoints).aidStations.map((station) => ({
        name: station.name,
        distanceKm: station.distanceKm,
      }))
    : [];

const buildGpxPreviewPayload = (parsedGpx: ParsedOrganizerGpx) => ({
  stats: parsedGpx.stats,
  elevationProfile: toElevationProfile(parsedGpx),
  detectedAidStations: toDetectedAidStations(parsedGpx),
});

const loadRaceGpxStoragePath = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  raceId: string
) => {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=id,gpx_storage_path&limit=1`,
    {
      headers: serviceHeaders(serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load organizer race GPX path", await response.text());
    return { error: jsonError("Unable to load race GPX.", 502) };
  }

  const race = z.array(raceGpxPathSchema).parse(await response.json())[0] ?? null;
  if (!race) return { error: jsonError("Race not found.", 404) };
  if (!race.gpx_storage_path) return { error: jsonError("This race has no GPX available.", 409) };

  return { storagePath: race.gpx_storage_path };
};

const loadExistingStationCount = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  raceId: string
) => {
  const existingStationsResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${raceId}&select=id&limit=1`,
    {
      headers: serviceHeaders(serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!existingStationsResponse.ok) {
    console.error("Unable to load existing aid stations before GPX import", await existingStationsResponse.text());
    return null;
  }

  return z.array(stationIdSchema).parse(await existingStationsResponse.json()).length;
};

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;

  const loadedPath = await loadRaceGpxStoragePath(auth.serviceConfig, parsedParams.data.id);
  if ("error" in loadedPath) return loadedPath.error;

  const gpxResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${loadedPath.storagePath}`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!gpxResponse.ok) {
    console.error("Unable to read organizer GPX", await gpxResponse.text());
    return jsonError("Unable to read race GPX.", 502);
  }

  try {
    const parsedGpx = parseGpx(await gpxResponse.text());
    return withSecurityHeaders(NextResponse.json(buildGpxPreviewPayload(parsedGpx)));
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown parse error";
    return jsonError(`Invalid GPX file: ${details}`, 422);
  }
}

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;

  const formData = (await request.formData().catch(() => null)) as globalThis.FormData | null;
  if (!formData) return jsonError("Invalid form data.", 400);

  const gpxFile = formData.get("gpx");
  if (!(gpxFile instanceof File)) return jsonError("GPX file is required.", 400);

  const gpxContent = await gpxFile.text();
  let parsedGpx: ReturnType<typeof parseGpx>;

  try {
    parsedGpx = parseGpx(gpxContent);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown parse error";
    return jsonError(`Invalid GPX file: ${details}`, 422);
  }

  const storagePath = `organizer/${race.event_id}/${parsedParams.data.id}/${Date.now()}.gpx`;
  const uploadResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`,
    {
      method: "POST",
      headers: {
        ...serviceHeaders(auth.serviceConfig, gpxFile.type || "application/gpx+xml"),
        "x-upsert": "true",
      },
      body: gpxFile,
    }
  );

  if (!uploadResponse.ok) {
    console.error("Unable to upload organizer GPX", await uploadResponse.text());
    return jsonError("Unable to upload GPX file.", 502);
  }

  const gpxSha = createHash("sha256").update(gpxContent).digest("hex");
  const updateResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(auth.serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        gpx_path: storagePath,
        gpx_hash: gpxSha,
        gpx_storage_path: storagePath,
        gpx_sha256: gpxSha,
        distance_km: parsedGpx.stats.distanceKm,
        elevation_gain_m: parsedGpx.stats.gainM,
        elevation_loss_m: parsedGpx.stats.lossM,
        min_alt_m: parsedGpx.stats.minAltM,
        max_alt_m: parsedGpx.stats.maxAltM,
        start_lat: parsedGpx.stats.startLat,
        start_lng: parsedGpx.stats.startLng,
        bounds_min_lat: parsedGpx.stats.boundsMinLat,
        bounds_min_lng: parsedGpx.stats.boundsMinLng,
        bounds_max_lat: parsedGpx.stats.boundsMaxLat,
        bounds_max_lng: parsedGpx.stats.boundsMaxLng,
      }),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    console.error("Unable to update race after organizer GPX upload", await updateResponse.text());
    await fetch(`${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`, {
      method: "DELETE",
      headers: serviceHeaders(auth.serviceConfig, ""),
    }).catch(() => null);
    return jsonError("Unable to update race GPX.", 502);
  }

  const detectedAidStations = toDetectedAidStations(parsedGpx);
  let appliedAidStationCount = 0;
  const existingStationCount = await loadExistingStationCount(auth.serviceConfig, parsedParams.data.id);

  if (existingStationCount === 0 && detectedAidStations.length > 0) {
    const stations = detectedAidStations.map((station, index) => ({
      race_id: parsedParams.data.id,
      name: station.name,
      km: station.distanceKm,
      water_available: true,
      solid_available: true,
      assistance_allowed: true,
      notes: null,
      order_index: index,
    }));

    if (stations.length > 0) {
      const stationInsertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations`, {
        method: "POST",
        headers: serviceHeaders(auth.serviceConfig),
        body: JSON.stringify(stations),
        cache: "no-store",
      }).catch((error) => {
        console.error("Unable to create GPX waypoint aid stations", error);
        return null;
      });

      if (stationInsertResponse?.ok) {
        appliedAidStationCount = stations.length;
      } else if (stationInsertResponse) {
        console.error("Unable to create GPX waypoint aid stations", await stationInsertResponse.text());
      }
    }
  }

  const updated = await updateResponse.json().catch(() => null);
  return withSecurityHeaders(
    NextResponse.json({
      race: Array.isArray(updated) ? updated[0] ?? null : null,
      ...buildGpxPreviewPayload(parsedGpx),
      appliedAidStationCount,
    })
  );
}
