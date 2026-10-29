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
import { isOrganizerRaceModuleSelected } from "../../../../../../lib/organizer-module-settings";
import { invalidateRacebookCache } from "../../../../../../lib/racebook-cache";

const nullableHttpUrl = z.union([z.string().trim().url().refine((value) => /^https?:\/\//i.test(value)), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);

const supporterPointRowSchema = z.object({
  id: z.string().uuid(),
  race_id: z.string().uuid(),
  name: z.string(),
  km: z.coerce.number().nullable(),
  order_index: z.number(),
  encouragement_allowed: z.boolean(),
  assistance_allowed: z.boolean(),
  access_label: z.string().nullable(),
  latitude: z.coerce.number().nullable(),
  longitude: z.coerce.number().nullable(),
  google_maps_url: z.string().nullable(),
  access_note: z.string().nullable(),
  plan_url: z.string().nullable(),
});

const supporterPointInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().max(120).default(""),
  distanceKm: z.number().min(0).nullable(),
  encouragementAllowed: z.boolean().default(false),
  assistanceAllowed: z.boolean().default(false),
  accessLabel: z.string().trim().max(240).optional().transform((value) => value || null),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  googleMapsUrl: nullableHttpUrl,
  accessNote: z.string().trim().max(2_000).optional().transform((value) => value || null),
  planUrl: nullableHttpUrl,
}).superRefine((point, context) => {
  if ((point.latitude === null) !== (point.longitude === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Coordinates must be provided together." });
  }
});

const updateSchema = z.object({ supporterPoints: z.array(supporterPointInputSchema).max(100) });
const select = "id,race_id,name,km,order_index,encouragement_allowed,assistance_allowed,access_label,latitude,longitude,google_maps_url,access_note,plan_url";

const serializePoint = (point: z.infer<typeof supporterPointRowSchema>, raceDistanceKm: number) => ({
  id: point.id,
  name: point.name,
  distanceKm: point.km,
  encouragementAllowed: point.encouragement_allowed,
  assistanceAllowed: point.assistance_allowed,
  accessLabel: point.access_label,
  latitude: point.latitude,
  longitude: point.longitude,
  googleMapsUrl: point.google_maps_url,
  accessNote: point.access_note,
  planUrl: point.plan_url,
  publishable: Boolean(
    point.name.trim()
    && point.km !== null
    && point.km >= 0
    && point.km <= raceDistanceKm
    && point.latitude !== null
    && point.longitude !== null
    && (point.encouragement_allowed || point.assistance_allowed)
  ),
});

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;
  const params = uuidParamSchema.safeParse(context.params);
  if (!params.success) return jsonError("Invalid race id.", 400);
  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, params.data.id);
  if ("error" in race) return race.error;

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_supporter_points?race_id=eq.${params.data.id}&select=${select}&order=order_index.asc`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!response.ok) return jsonError("Unable to load supporter points.", 502);
  const rows = z.array(supporterPointRowSchema).parse(await response.json());
  return withSecurityHeaders(NextResponse.json({
    supporterPoints: rows.map((point) => serializePoint(point, Number(race.distance_km))),
  }));
}

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;
  const params = uuidParamSchema.safeParse(context.params);
  if (!params.success) return jsonError("Invalid race id.", 400);
  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, params.data.id);
  if ("error" in race) return race.error;
  if (!race.edition_id || !(await isOrganizerRaceModuleSelected(auth.serviceConfig, race.edition_id, params.data.id, "supporter_points"))) {
    return jsonError("Activez la section Points supporters pour modifier son brouillon.", 403);
  }

  const body = updateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || body.data.supporterPoints.some((point) => point.distanceKm !== null && point.distanceKm > Number(race.distance_km))) {
    return jsonError("Invalid supporter points.", 400);
  }
  const sorted = body.data.supporterPoints
    .map((point, index) => ({ point, index }))
    .sort((left, right) => (left.point.distanceKm ?? Number.POSITIVE_INFINITY) - (right.point.distanceKm ?? Number.POSITIVE_INFINITY) || left.index - right.index)
    .map(({ point }) => point);
  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/replace_race_supporter_points`, {
    method: "POST",
    headers: serviceHeaders(auth.serviceConfig),
    body: JSON.stringify({
      p_race_id: params.data.id,
      p_items: sorted.map((point) => ({
        id: point.id ?? null,
        name: point.name,
        km: point.distanceKm === null ? null : Number(point.distanceKm.toFixed(2)),
        encouragement_allowed: point.encouragementAllowed,
        assistance_allowed: point.assistanceAllowed,
        access_label: point.accessLabel,
        latitude: point.latitude,
        longitude: point.longitude,
        google_maps_url: point.googleMapsUrl,
        access_note: point.accessNote,
        plan_url: point.planUrl,
      })),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("Unable to replace supporter points", await response.text());
    return jsonError("Unable to update supporter points.", 502);
  }
  const rows = z.array(supporterPointRowSchema).parse(await response.json());
  await invalidateRacebookCache({ raceId: params.data.id });
  return withSecurityHeaders(NextResponse.json({
    supporterPoints: rows.map((point) => serializePoint(point, Number(race.distance_km))),
  }));
}
