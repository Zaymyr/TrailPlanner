import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  jsonError,
  loadRaceForOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";
import { requireOrganizerRaceCapability } from "../../../../../../lib/organizer-entitlements";

const relayPointRowSchema = z.object({
  id: z.string().uuid(),
  race_aid_station_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  km: z.number(),
  handover_time: z.string().nullable().optional(),
  cutoff_time: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  order_index: z.number().int(),
});
type RelayPointRow = z.infer<typeof relayPointRowSchema>;

const relayPointInputSchema = z.object({
  id: z.string().uuid().optional(),
  raceAidStationId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1),
  distanceKm: z.coerce.number().positive(),
  handoverTime: z.string().trim().optional().transform((value) => value || null),
  cutoffTime: z.string().trim().optional().transform((value) => value || null),
  notes: z.string().trim().optional().transform((value) => value || null),
});

const updateRelayPointsSchema = z.object({
  relayPoints: z.array(relayPointInputSchema),
});

const raceRelayConfigSchema = z.object({
  distance_km: z.number(),
  participation_mode: z.enum(["solo", "relay", "solo_and_relay"]).nullable().optional(),
});

const mapRelayPoint = (point: z.infer<typeof relayPointRowSchema>) => ({
  id: point.id,
  raceAidStationId: point.race_aid_station_id ?? null,
  name: point.name,
  distanceKm: point.km,
  handoverTime: point.handover_time ?? "",
  cutoffTime: point.cutoff_time ?? "",
  notes: point.notes ?? "",
});

const loadRelayPoints = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  raceId: string,
): Promise<{ error: Response } | { points: RelayPointRow[] }> => {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_relay_points?race_id=eq.${raceId}&select=id,race_aid_station_id,name,km,handover_time,cutoff_time,notes,order_index&order=order_index.asc`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" },
  );

  if (!response.ok) return { error: response };
  return { points: z.array(relayPointRowSchema).parse(await response.json()) };
};

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;
  if (!(await requireOrganizerRaceCapability(auth.serviceConfig, parsedParams.data.id, "relay.manage"))) {
    return jsonError("RaceBook Pro est requis pour gérer les relais.", 403);
  }

  const result = await loadRelayPoints(auth.serviceConfig, parsedParams.data.id);
  if (!("points" in result)) {
    console.error("Unable to load organizer relay points", await result.error.text());
    return jsonError("Unable to load relay points.", 502);
  }

  return withSecurityHeaders(NextResponse.json({ relayPoints: result.points.map(mapRelayPoint) }));
}

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;
  if (!(await requireOrganizerRaceCapability(auth.serviceConfig, parsedParams.data.id, "relay.manage"))) {
    return jsonError("RaceBook Pro est requis pour gérer les relais.", 403);
  }

  const parsedBody = updateRelayPointsSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid relay points.", 400);

  const [raceResponse, stationsResponse] = await Promise.all([
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${parsedParams.data.id}&select=distance_km,participation_mode&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${parsedParams.data.id}&select=id`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
    ),
  ]);

  if (!raceResponse.ok || !stationsResponse.ok) {
    return jsonError("Unable to validate relay points.", 502);
  }

  const relayConfig = z.array(raceRelayConfigSchema).parse(await raceResponse.json())[0] ?? null;
  if (!relayConfig) return jsonError("Race not found.", 404);
  if (parsedBody.data.relayPoints.length > 0 && relayConfig.participation_mode === "solo") {
    return jsonError("Enable relay participation before adding relay points.", 409);
  }

  const stationIds = new Set(
    z.array(z.object({ id: z.string().uuid() })).parse(await stationsResponse.json()).map((station) => station.id),
  );
  const sortedRelayPoints = [...parsedBody.data.relayPoints].sort((left, right) => left.distanceKm - right.distanceKm);

  if (sortedRelayPoints.some((point) => point.distanceKm >= relayConfig.distance_km)) {
    return jsonError("Chaque point de relais doit se situer avant l'arrivée.", 409);
  }
  if (sortedRelayPoints.some((point) => point.raceAidStationId && !stationIds.has(point.raceAidStationId))) {
    return jsonError("Un point de relais référence un ravito qui n'appartient pas à ce format.", 409);
  }

  const submittedIds = sortedRelayPoints.flatMap((point) => (point.id ? [point.id] : []));
  if (new Set(submittedIds).size !== submittedIds.length) {
    return jsonError("Un point de relais ne peut être envoyé qu'une seule fois.", 400);
  }
  if (submittedIds.length > 0) {
    const existingResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_relay_points?race_id=eq.${parsedParams.data.id}&id=in.(${submittedIds.join(",")})&select=id`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
    );
    if (!existingResponse.ok) return jsonError("Unable to validate relay points.", 502);

    const existingIds = new Set(
      z.array(z.object({ id: z.string().uuid() })).parse(await existingResponse.json()).map((point) => point.id),
    );
    if (submittedIds.some((id) => !existingIds.has(id))) {
      return jsonError("Un point de relais n'appartient pas à ce format.", 409);
    }
  }
  const deleteFilter = submittedIds.length > 0
    ? `race_id=eq.${parsedParams.data.id}&id=not.in.(${submittedIds.join(",")})`
    : `race_id=eq.${parsedParams.data.id}`;
  const deleteResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_relay_points?${deleteFilter}`,
    { method: "DELETE", headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!deleteResponse.ok) return jsonError("Unable to update relay points.", 502);

  for (const [index, point] of sortedRelayPoints.entries()) {
    const payload = {
      race_id: parsedParams.data.id,
      race_aid_station_id: point.raceAidStationId ?? null,
      name: point.name,
      km: Number(point.distanceKm.toFixed(2)),
      handover_time: point.handoverTime,
      cutoff_time: point.cutoffTime,
      notes: point.notes,
      order_index: index,
    };
    const response = await fetch(
      point.id
        ? `${auth.serviceConfig.supabaseUrl}/rest/v1/race_relay_points?id=eq.${point.id}&race_id=eq.${parsedParams.data.id}`
        : `${auth.serviceConfig.supabaseUrl}/rest/v1/race_relay_points`,
      {
        method: point.id ? "PATCH" : "POST",
        headers: serviceHeaders(auth.serviceConfig),
        body: JSON.stringify(payload),
        cache: "no-store",
      },
    );
    if (!response.ok) return jsonError("Unable to update relay points.", 502);
  }

  const result = await loadRelayPoints(auth.serviceConfig, parsedParams.data.id);
  if (!("points" in result)) return jsonError("Relay points saved, but unable to reload them.", 502);
  return withSecurityHeaders(NextResponse.json({ relayPoints: result.points.map(mapRelayPoint) }));
}
