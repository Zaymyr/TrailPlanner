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
import {
  organizerAidStationDetailsSchema,
  parseOrganizerAidStationDetails,
} from "../../../../../../lib/organizer-dashboard-details";
import { isOrganizerRaceModuleSelected } from "../../../../../../lib/organizer-module-settings";
import { invalidateRacebookCache } from "../../../../../../lib/racebook-cache";

const aidStationRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
  water_available: z.boolean(),
  solid_available: z.boolean().optional().default(true),
  assistance_allowed: z.boolean().optional().default(true),
  notes: z.string().nullable().optional(),
  order_index: z.number(),
  organizer_details: z.unknown().nullable().optional(),
});

const aidStationInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  distanceKm: z.coerce.number().nonnegative(),
  waterRefill: z.boolean().optional().default(true),
  solidRefill: z.boolean().optional().default(true),
  assistanceAllowed: z.boolean().optional().default(true),
  notes: z.string().trim().optional().transform((value) => (value ? value : null)),
  organizerDetails: organizerAidStationDetailsSchema.optional(),
});

const updateAidStationsSchema = z.object({
  aidStations: z.array(aidStationInputSchema),
});

const sortAidStationsByDistance = <T extends { distanceKm: number }>(aidStations: T[]) =>
  aidStations
    .map((station, index) => ({ station, index }))
    .sort((left, right) => {
      const distanceDelta = left.station.distanceKm - right.station.distanceKm;
      if (distanceDelta !== 0) return distanceDelta;
      return left.index - right.index;
    })
    .map(({ station }) => station);

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;
  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${parsedParams.data.id}&select=id,name,km,water_available,solid_available,assistance_allowed,notes,order_index,organizer_details&order=order_index.asc`,
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
  return withSecurityHeaders(
    NextResponse.json({
      aidStations: aidStations.map((station) => ({
        ...station,
        organizerDetails: parseOrganizerAidStationDetails(station.organizer_details),
      })),
    })
  );
}

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;
  if (!race.edition_id || !(await isOrganizerRaceModuleSelected(auth.serviceConfig, race.edition_id, parsedParams.data.id, "aid_stations"))) return jsonError("Activez la section Ravitos pour modifier son brouillon.", 403);

  const parsedBody = updateAidStationsSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid aid stations.", 400);

  const sortedAidStations = sortAidStationsByDistance(parsedBody.data.aidStations);
  const replaceResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/replace_race_aid_stations`,
    {
      method: "POST",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify({
        p_race_id: parsedParams.data.id,
        p_items: sortedAidStations.map((station, orderIndex) => ({
          id: station.id ?? null,
          name: station.name,
          km: Number(station.distanceKm.toFixed(2)),
          water_available: station.waterRefill,
          solid_available: station.solidRefill,
          assistance_allowed: station.assistanceAllowed,
          notes: station.notes,
          organizer_details: station.organizerDetails ?? null,
          order_index: orderIndex,
        })),
      }),
      cache: "no-store",
    }
  );

  if (!replaceResponse.ok) {
    console.error("Unable to replace organizer aid stations", await replaceResponse.text());
    return jsonError("Unable to update aid stations.", 502);
  }

  const aidStations = z.array(aidStationRowSchema).parse(await replaceResponse.json());
  await invalidateRacebookCache({ raceId: parsedParams.data.id });
  return withSecurityHeaders(
    NextResponse.json({
      aidStations: aidStations.map((station) => ({
        ...station,
        organizerDetails: parseOrganizerAidStationDetails(station.organizer_details),
      })),
    })
  );
}
