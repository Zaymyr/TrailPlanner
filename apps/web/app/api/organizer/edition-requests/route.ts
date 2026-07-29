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
});

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
  const [sourceResponse, targetResponse] = await Promise.all([
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/races?event_id=eq.${parsed.data.eventId}&race_date=gte.${parsed.data.sourceYear}-01-01&race_date=lt.${parsed.data.sourceYear + 1}-01-01&select=id,name,race_date&order=race_date.asc`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/races?event_id=eq.${parsed.data.eventId}&race_date=gte.${targetYear}-01-01&race_date=lt.${targetYear + 1}-01-01&select=id&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
    ),
  ]);

  if (!sourceResponse.ok || !targetResponse.ok) return jsonError("Unable to inspect event editions.", 502);
  if (((await targetResponse.json()) as unknown[]).length > 0) return jsonError("An edition already exists for that year.", 409);

  const sourceRaces = z.array(sourceRaceSchema).parse(await sourceResponse.json());
  if (sourceRaces.length === 0) return jsonError("No format exists for the source year.", 409);

  const earliestSourceDate = sourceRaces.map((race) => race.race_date).filter((date): date is string => Boolean(date)).sort()[0];
  const dayShift = earliestSourceDate
    ? Math.round((parseDate(parsed.data.requestedStartDate).getTime() - parseDate(earliestSourceDate).getTime()) / DAY_IN_MS)
    : 0;
  const authorization = request.headers.get("authorization") ?? "";
  const createdRaces: z.infer<typeof createdRaceSchema>[] = [];

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
    console.error("Unable to create organizer edition", error);
    return jsonError(error instanceof Error ? error.message : "Unable to create edition.", 502);
  }

  return withSecurityHeaders(NextResponse.json({ races: createdRaces }, { status: 201 }));
}
