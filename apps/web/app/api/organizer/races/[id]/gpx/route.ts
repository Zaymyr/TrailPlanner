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

  const existingStationsResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${parsedParams.data.id}&select=id&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (
    existingStationsResponse.ok &&
    z.array(z.object({ id: z.string().uuid() })).parse(await existingStationsResponse.json()).length === 0 &&
    parsedGpx.pointSource !== "waypoint" &&
    parsedGpx.waypoints.length > 0
  ) {
    const stations = normalizeImportedWaypoints(parsedGpx.points, parsedGpx.waypoints).aidStations.map((station, index) => ({
      race_id: parsedParams.data.id,
      name: station.name,
      km: station.distanceKm,
      water_available: true,
      notes: null,
      order_index: index,
    }));

    if (stations.length > 0) {
      await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations`, {
        method: "POST",
        headers: serviceHeaders(auth.serviceConfig),
        body: JSON.stringify(stations),
        cache: "no-store",
      }).catch((error) => console.error("Unable to create GPX waypoint aid stations", error));
    }
  }

  const updated = await updateResponse.json().catch(() => null);
  return withSecurityHeaders(NextResponse.json({ race: Array.isArray(updated) ? updated[0] ?? null : null }));
}
