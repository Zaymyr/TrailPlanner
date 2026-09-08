import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../../lib/http";
import { loadOrganizerEditionEntitlement } from "../../../../../../lib/organizer-entitlements";
import { canEnableOrganizerModule, loadOrganizerModuleSettings } from "../../../../../../lib/organizer-module-settings";
import { organizerModuleSettingsPatchSchema } from "../../../../../../lib/organizer-modules";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders, uuidParamSchema } from "../../../../../../lib/organizer";

const editionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  module_setup_completed_at: z.string().nullable(),
});
const raceSchema = z.object({ id: z.string().uuid() });
const settingRowSchema = z.object({ id: z.string().uuid(), race_id: z.string().uuid().nullable(), module_key: z.string() });

async function authorize(request: NextRequest, editionId: string) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth;
  const [editionResponse, racesResponse] = await Promise.all([
    fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${editionId}&select=id,event_id,module_setup_completed_at&limit=1`, { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }),
    fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/races?edition_id=eq.${editionId}&select=id`, { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }),
  ]);
  if (!editionResponse.ok || !racesResponse.ok) return { error: jsonError("Unable to load edition modules.", 502) };
  const edition = z.array(editionSchema).parse(await editionResponse.json())[0];
  if (!edition) return { error: jsonError("Edition not found.", 404) };
  const membership = await requireEventOrganizer(auth.serviceConfig, auth.user, edition.event_id);
  if (membership !== true) return { error: membership.error };
  return { ...auth, edition, races: z.array(raceSchema).parse(await racesResponse.json()) };
}

async function responsePayload(auth: Exclude<Awaited<ReturnType<typeof authorize>>, { error: NextResponse }>) {
  const raceIds = auth.races.map((race) => race.id);
  const [settings, entitlement] = await Promise.all([
    loadOrganizerModuleSettings(auth.serviceConfig, auth.edition.id, raceIds),
    loadOrganizerEditionEntitlement(auth.serviceConfig, auth.edition.id),
  ]);
  return {
    setupCompletedAt: auth.edition.module_setup_completed_at,
    tier: entitlement?.status === "active" ? entitlement.tier : "visibility",
    ...settings,
  };
}

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const params = uuidParamSchema.safeParse(context.params);
  if (!params.success) return jsonError("Invalid edition id.", 400);
  const auth = await authorize(request, params.data.id);
  if ("error" in auth) return auth.error;
  try {
    return withSecurityHeaders(NextResponse.json(await responsePayload(auth)));
  } catch (error) {
    console.error("Unable to load organizer module settings", error);
    return jsonError("Unable to load edition modules.", 502);
  }
}

export async function PATCH(request: NextRequest, context: { params: { id?: string } }) {
  const params = uuidParamSchema.safeParse(context.params);
  if (!params.success) return jsonError("Invalid edition id.", 400);
  const body = organizerModuleSettingsPatchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(body.error.issues[0]?.message ?? "Invalid module settings.", 400);
  const auth = await authorize(request, params.data.id);
  if ("error" in auth) return auth.error;
  const raceIds = new Set(auth.races.map((race) => race.id));
  if (body.data.updates.some((update) => update.scope === "race" && !raceIds.has(update.raceId))) {
    return jsonError("A format does not belong to this edition.", 409);
  }
  const entitlement = await loadOrganizerEditionEntitlement(auth.serviceConfig, auth.edition.id);
  const forbidden = body.data.updates.find((update) => update.enabled && !canEnableOrganizerModule(entitlement, update.moduleKey));
  if (forbidden) return jsonError("Cette section nécessite une offre supérieure.", 403);

  const existingResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_racebook_module_settings?edition_id=eq.${auth.edition.id}&select=id,race_id,module_key`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!existingResponse.ok) return jsonError("Unable to update edition modules.", 502);
  const existing = z.array(settingRowSchema).parse(await existingResponse.json());

  const mutationResults = await Promise.all(body.data.updates.map((update) => {
    const raceId = update.scope === "race" ? update.raceId : null;
    const current = existing.find((row) => row.race_id === raceId && row.module_key === update.moduleKey);
    return current
      ? fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_racebook_module_settings?id=eq.${current.id}`, {
          method: "PATCH", headers: serviceHeaders(auth.serviceConfig),
          body: JSON.stringify({ is_enabled: update.enabled, configured_by: auth.user.id }), cache: "no-store",
        })
      : fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_racebook_module_settings`, {
          method: "POST", headers: serviceHeaders(auth.serviceConfig),
          body: JSON.stringify({ edition_id: auth.edition.id, race_id: raceId, module_key: update.moduleKey, is_enabled: update.enabled, configured_by: auth.user.id }), cache: "no-store",
        });
  }));
  if (mutationResults.some((result) => !result.ok)) return jsonError("Unable to update edition modules.", 502);

  if (body.data.setupCompleted) {
    const completedAt = new Date().toISOString();
    const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${auth.edition.id}`, {
      method: "PATCH", headers: serviceHeaders(auth.serviceConfig), body: JSON.stringify({ module_setup_completed_at: completedAt }), cache: "no-store",
    });
    if (!response.ok) return jsonError("Unable to complete module setup.", 502);
    auth.edition.module_setup_completed_at = completedAt;
  }

  return withSecurityHeaders(NextResponse.json(await responsePayload(auth)));
}
