import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders } from "../../../../lib/organizer";
import { POST as createRace } from "../races/route";
import { DELETE as deleteRace } from "../races/[id]/route";

const createEditionSchema = z.object({
  eventId: z.string().uuid(),
  sourceYear: z.number().int().min(2000).max(2100),
  requestedStartDate: z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), "Invalid requested start date."),
  requestedEndDate: z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), "Invalid requested end date."),
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
  const [sourceEditionResponse, targetResponse, currentResponse] = await Promise.all([
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?event_id=eq.${parsed.data.eventId}&edition_year=eq.${parsed.data.sourceYear}&select=id&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?event_id=eq.${parsed.data.eventId}&edition_year=eq.${targetYear}&select=id&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?event_id=eq.${parsed.data.eventId}&is_current=eq.true&select=id&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    ),
  ]);

  if (!sourceEditionResponse.ok || !targetResponse.ok || !currentResponse.ok) return jsonError("Unable to inspect event editions.", 502);
  if (((await targetResponse.json()) as unknown[]).length > 0) return jsonError("An edition already exists for that year.", 409);
  const previousCurrentEditionId = z.array(z.object({ id: z.string().uuid() })).parse(await currentResponse.json())[0]?.id ?? null;
  const sourceEditionId = z.array(z.object({ id: z.string().uuid() })).parse(await sourceEditionResponse.json())[0]?.id ?? null;
  if (!sourceEditionId) return jsonError("Source edition not found.", 409);

  const sourceResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/races?edition_id=eq.${sourceEditionId}&select=id,name,race_date&order=race_date.asc`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!sourceResponse.ok) return jsonError("Unable to inspect source formats.", 502);
  const sourceRaces = z.array(sourceRaceSchema).parse(await sourceResponse.json());
  if (sourceRaces.length === 0) return jsonError("No format exists for the source year.", 409);

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
      createdRaces.push(createdRaceSchema.parse(payload.race));
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
        body: JSON.stringify({ is_current: true }),
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
