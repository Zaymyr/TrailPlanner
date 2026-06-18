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

const aidStationRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
  water_available: z.boolean(),
  solid_available: z.boolean().optional().default(true),
  assistance_allowed: z.boolean().optional().default(true),
  notes: z.string().nullable().optional(),
  order_index: z.number(),
});

const aidStationInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  distanceKm: z.coerce.number().nonnegative(),
  waterRefill: z.boolean().optional().default(true),
  solidRefill: z.boolean().optional().default(true),
  assistanceAllowed: z.boolean().optional().default(true),
  notes: z.string().trim().optional().transform((value) => (value ? value : null)),
});

const updateAidStationsSchema = z.object({
  aidStations: z.array(aidStationInputSchema),
});

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${parsedParams.data.id}&select=id,name,km,water_available,solid_available,assistance_allowed,notes,order_index&order=order_index.asc`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load organizer aid stations", await response.text());
    return jsonError("Unable to load aid stations.", 502);
  }

  const aidStations = z.array(aidStationRowSchema).parse(await response.json());
  return withSecurityHeaders(NextResponse.json({ aidStations }));
}

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;

  const parsedBody = updateAidStationsSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid aid stations.", 400);

  const submittedIds = parsedBody.data.aidStations
    .map((station) => station.id)
    .filter((id): id is string => Boolean(id));
  const deleteFilter =
    submittedIds.length > 0
      ? `race_id=eq.${parsedParams.data.id}&id=not.in.(${submittedIds.join(",")})`
      : `race_id=eq.${parsedParams.data.id}`;
  const deleteResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?${deleteFilter}`,
    {
      method: "DELETE",
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!deleteResponse.ok) {
    console.error("Unable to delete organizer aid stations", await deleteResponse.text());
    return jsonError("Unable to update aid stations.", 502);
  }

  if (parsedBody.data.aidStations.length === 0) {
    return withSecurityHeaders(NextResponse.json({ aidStations: [] }));
  }

  const existingStationUpdates = parsedBody.data.aidStations.filter((station) => station.id);
  const newStations = parsedBody.data.aidStations.filter((station) => !station.id);

  for (const station of existingStationUpdates) {
    const index = parsedBody.data.aidStations.indexOf(station);
    const updateResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?id=eq.${station.id}&race_id=eq.${parsedParams.data.id}`,
      {
        method: "PATCH",
        headers: serviceHeaders(auth.serviceConfig),
        body: JSON.stringify({
          name: station.name,
          km: Number(station.distanceKm.toFixed(2)),
          water_available: station.waterRefill,
          solid_available: station.solidRefill,
          assistance_allowed: station.assistanceAllowed,
          notes: station.notes,
          order_index: index,
        }),
        cache: "no-store",
      }
    );

    if (!updateResponse.ok) {
      console.error("Unable to update organizer aid station", await updateResponse.text());
      return jsonError("Unable to update aid stations.", 502);
    }
  }

  if (newStations.length > 0) {
    const insertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations`, {
      method: "POST",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify(
        newStations.map((station) => {
          const index = parsedBody.data.aidStations.indexOf(station);
          return {
            race_id: parsedParams.data.id,
            name: station.name,
            km: Number(station.distanceKm.toFixed(2)),
            water_available: station.waterRefill,
            solid_available: station.solidRefill,
            assistance_allowed: station.assistanceAllowed,
            notes: station.notes,
            order_index: index,
          };
        })
      ),
      cache: "no-store",
    });

    if (!insertResponse.ok) {
      console.error("Unable to insert organizer aid stations", await insertResponse.text());
      return jsonError("Unable to update aid stations.", 502);
    }
  }

  const reloadResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${parsedParams.data.id}&select=id,name,km,water_available,solid_available,assistance_allowed,notes,order_index&order=order_index.asc`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!reloadResponse.ok) {
    console.error("Unable to reload organizer aid stations", await reloadResponse.text());
    return jsonError("Aid stations were updated, but could not be reloaded.", 502);
  }

  const aidStations = z.array(aidStationRowSchema).parse(await reloadResponse.json());
  return withSecurityHeaders(NextResponse.json({ aidStations }));
}
