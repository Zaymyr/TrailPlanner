import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders } from "../../../../lib/organizer";
import { POST as createRace } from "../races/route";
import { DELETE as deleteRace } from "../races/[id]/route";
import { requireOrganizerEditionCapability } from "../../../../lib/organizer-entitlements";

const createEditionSchema = z.object({
  eventId: z.string().uuid(),
  sourceYear: z.number().int().min(2000).max(2100),
  requestedStartDate: z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), "Invalid requested start date."),
  requestedEndDate: z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), "Invalid requested end date."),
  duplicatePreviousEdition: z.boolean().default(true),
}).refine(
  (value) => value.requestedEndDate >= value.requestedStartDate,
  "Invalid edition date range."
);

const sourceRaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  race_date: z.string().nullable().optional(),
});

const createdRaceSchema = z.object({
  id: z.string().uuid(),
  edition_group_id: z.string().uuid(),
  race_date: z.string().nullable().optional(),
});

const editionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_year: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  is_current: z.boolean(),
  is_visible: z.boolean().default(true),
});

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const parseDate = (value: string) => new Date(`${value}T00:00:00Z`);
const formatDate = (value: Date) => value.toISOString().slice(0, 10);

export async function POST(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsed = createEditionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid edition.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsed.data.eventId);
  if (organizer !== true) return organizer.error;

  const targetYear = Number(parsed.data.requestedStartDate.slice(0, 4));
  const [targetResponse, currentResponse] = await Promise.all([
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?event_id=eq.${parsed.data.eventId}&edition_year=eq.${targetYear}&select=id&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?event_id=eq.${parsed.data.eventId}&is_current=eq.true&select=id&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    ),
  ]);

  if (!targetResponse.ok || !currentResponse.ok) return jsonError("Unable to inspect event editions.", 502);
  if (((await targetResponse.json()) as unknown[]).length > 0) return jsonError("An edition already exists for that year.", 409);
  const previousCurrentEditionId = z.array(z.object({ id: z.string().uuid() })).parse(await currentResponse.json())[0]?.id ?? null;
  let sourceRaces: z.infer<typeof sourceRaceSchema>[] = [];
  let sourceEditionId: string | null = null;
  let sourceModuleSettings: Array<{ race_id: string | null; module_key: string; is_enabled: boolean }> = [];
  if (parsed.data.duplicatePreviousEdition) {
    const sourceEditionResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?event_id=eq.${parsed.data.eventId}&edition_year=eq.${parsed.data.sourceYear}&select=id&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    );
    if (!sourceEditionResponse.ok) return jsonError("Unable to inspect source edition.", 502);
    sourceEditionId = z.array(z.object({ id: z.string().uuid() })).parse(await sourceEditionResponse.json())[0]?.id ?? null;
    if (!sourceEditionId) return jsonError("Source edition not found.", 409);
    if (!(await requireOrganizerEditionCapability(auth.serviceConfig, sourceEditionId, "edition.duplicate"))) {
      return jsonError("L’offre Complet est requise pour dupliquer une édition.", 403);
    }

    const sourceResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/races?edition_id=eq.${sourceEditionId}&select=id,name,race_date&order=race_date.asc`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    );
    if (!sourceResponse.ok) return jsonError("Unable to inspect source formats.", 502);
    sourceRaces = z.array(sourceRaceSchema).parse(await sourceResponse.json());
    if (sourceRaces.length === 0) return jsonError("No format exists for the source year.", 409);
    const settingsResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_racebook_module_settings?edition_id=eq.${sourceEditionId}&select=race_id,module_key,is_enabled`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
    );
    if (!settingsResponse.ok) return jsonError("Unable to inspect source module settings.", 502);
    sourceModuleSettings = z.array(z.object({ race_id: z.string().uuid().nullable(), module_key: z.string(), is_enabled: z.boolean() })).parse(await settingsResponse.json());
  }

  const earliestSourceDate = sourceRaces.map((race) => race.race_date).filter((date): date is string => Boolean(date)).sort()[0];
  const dayShift = earliestSourceDate
    ? Math.round((parseDate(parsed.data.requestedStartDate).getTime() - parseDate(earliestSourceDate).getTime()) / DAY_IN_MS)
    : 0;
  const authorization = request.headers.get("authorization") ?? "";
  const createdRaces: z.infer<typeof createdRaceSchema>[] = [];
  const editionInsertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions`, {
    method: "POST",
    headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
    body: JSON.stringify({
      event_id: parsed.data.eventId,
      edition_year: targetYear,
      start_date: parsed.data.requestedStartDate,
      end_date: parsed.data.requestedEndDate,
      is_current: false,
    }),
    cache: "no-store",
  });
  if (!editionInsertResponse.ok) return jsonError("Unable to create event edition.", 502);
  const edition = z.array(editionSchema).parse(await editionInsertResponse.json())[0] ?? null;
  if (!edition) return jsonError("Unable to create event edition.", 502);

  try {
    if (sourceEditionId) {
      const servicesResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_edition_services?edition_id=eq.${sourceEditionId}&select=service_type,name,description,address,latitude,longitude,google_maps_url,website_url,phone,order_index`, { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" });
      if (!servicesResponse.ok) throw new Error("Unable to load source edition services.");
      const services = z.array(z.record(z.unknown())).parse(await servicesResponse.json());
      if (services.length > 0) {
        const copyResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_edition_services`, { method: "POST", headers: serviceHeaders(auth.serviceConfig), body: JSON.stringify(services.map((service) => ({ ...service, edition_id: edition.id }))), cache: "no-store" });
        if (!copyResponse.ok) throw new Error("Unable to clone edition services.");
      }
      const editionSettings = sourceModuleSettings.filter((setting) => setting.race_id === null);
      for (const setting of editionSettings) {
        const existingSettingResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_racebook_module_settings?edition_id=eq.${edition.id}&race_id=is.null&module_key=eq.${setting.module_key}&select=id`, { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" });
        if (!existingSettingResponse.ok) throw new Error("Unable to inspect cloned edition module settings.");
        const existingSettingId = z.array(z.object({ id: z.string().uuid() })).parse(await existingSettingResponse.json())[0]?.id;
        const settingsCopyResponse = await fetch(existingSettingId
          ? `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_racebook_module_settings?id=eq.${existingSettingId}`
          : `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_racebook_module_settings`, {
          method: existingSettingId ? "PATCH" : "POST",
          headers: serviceHeaders(auth.serviceConfig),
          body: JSON.stringify(existingSettingId
            ? { is_enabled: setting.is_enabled, configured_by: auth.user.id }
            : { edition_id: edition.id, race_id: null, module_key: setting.module_key, is_enabled: setting.is_enabled, configured_by: auth.user.id }),
          cache: "no-store",
        });
        if (!settingsCopyResponse.ok) throw new Error("Unable to clone edition module settings.");
      }
    }
    for (const sourceRace of sourceRaces) {
      const raceDate = sourceRace.race_date
        ? formatDate(new Date(parseDate(sourceRace.race_date).getTime() + dayShift * DAY_IN_MS))
        : parsed.data.requestedStartDate;
      const createRequest = new NextRequest(new URL("/api/organizer/races", request.url), {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: parsed.data.eventId,
          editionId: edition.id,
          cloneFromRaceId: sourceRace.id,
          name: sourceRace.name,
          raceDate,
        }),
      });
      const response = await createRace(createRequest);
      const payload = (await response.json().catch(() => null)) as { race?: unknown; message?: string } | null;
      if (!response.ok || !payload?.race) throw new Error(payload?.message ?? "Unable to clone a format.");
      const createdRace = createdRaceSchema.parse(payload.race);
      createdRaces.push(createdRace);
      const raceSettings = sourceModuleSettings.filter((setting) => setting.race_id === sourceRace.id);
      for (const setting of raceSettings) {
        const currentSettingResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_racebook_module_settings?race_id=eq.${createdRace.id}&module_key=eq.${setting.module_key}&select=id`, { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" });
        if (!currentSettingResponse.ok) throw new Error("Unable to inspect cloned format module settings.");
        const currentSettingId = z.array(z.object({ id: z.string().uuid() })).parse(await currentSettingResponse.json())[0]?.id;
        const existingResponse = await fetch(currentSettingId
          ? `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_racebook_module_settings?id=eq.${currentSettingId}`
          : `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_racebook_module_settings`, {
          method: currentSettingId ? "PATCH" : "POST",
          headers: serviceHeaders(auth.serviceConfig),
          body: JSON.stringify(currentSettingId
            ? { is_enabled: setting.is_enabled, configured_by: auth.user.id }
            : { edition_id: edition.id, race_id: createdRace.id, module_key: setting.module_key, is_enabled: setting.is_enabled, configured_by: auth.user.id }),
          cache: "no-store",
        });
        if (!existingResponse.ok) throw new Error("Unable to clone format module settings.");
      }
    }

    if (previousCurrentEditionId) {
      const deactivateResponse = await fetch(
        `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${previousCurrentEditionId}`,
        {
          method: "PATCH",
          headers: serviceHeaders(auth.serviceConfig),
          body: JSON.stringify({ is_current: false }),
          cache: "no-store",
        }
      );
      if (!deactivateResponse.ok) throw new Error("Unable to deactivate the previous event edition.");
    }

    const activateResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${edition.id}`,
      {
        method: "PATCH",
        headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
        body: JSON.stringify({ is_current: true, ...(sourceEditionId ? { module_setup_completed_at: new Date().toISOString() } : {}) }),
        cache: "no-store",
      }
    );
    if (!activateResponse.ok) throw new Error("Unable to activate the new event edition.");
  } catch (error) {
    await Promise.all(
      createdRaces.map((race) =>
        deleteRace(
          new NextRequest(new URL(`/api/organizer/races/${race.id}`, request.url), {
            method: "DELETE",
            headers: { Authorization: authorization },
          }),
          { params: { id: race.id } }
        )
      )
    );
    await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${edition.id}`, {
      method: "DELETE",
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }).catch(() => null);
    if (previousCurrentEditionId) {
      await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${previousCurrentEditionId}`, {
        method: "PATCH",
        headers: serviceHeaders(auth.serviceConfig),
        body: JSON.stringify({ is_current: true }),
        cache: "no-store",
      }).catch(() => null);
    }
    console.error("Unable to create organizer edition", error);
    return jsonError(error instanceof Error ? error.message : "Unable to create edition.", 502);
  }

  return withSecurityHeaders(NextResponse.json({ edition: { ...edition, is_current: true }, races: createdRaces }, { status: 201 }));
}
