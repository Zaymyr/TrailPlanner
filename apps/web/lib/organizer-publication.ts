import { z } from "zod";

import { serviceHeaders, type OrganizerAuth } from "./organizer";

const publicationEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  race_event_editions: z.array(z.object({
    id: z.string().uuid(),
    start_date: z.string(),
    end_date: z.string(),
    is_current: z.boolean(),
  })).nullable().optional(),
  races: z
    .array(
      z.object({
        id: z.string().uuid(),
        edition_id: z.string().uuid().nullable().optional(),
        name: z.string().nullable().optional(),
        distance_km: z.number(),
        elevation_gain_m: z.number(),
      })
    )
    .nullable()
    .optional(),
});

export type PublicationReadiness =
  | { ok: true; publishableRaceCount: number; raceId: string }
  | { ok: false; message: string; status: number };

export async function validateOrganizerEventPublication(
  serviceConfig: OrganizerAuth["serviceConfig"],
  eventId: string,
  raceId: string
): Promise<PublicationReadiness> {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}&select=id,name,location,race_event_editions(id,start_date,end_date,is_current),races(id,edition_id,name,distance_km,elevation_gain_m)&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  );

  if (!response.ok) {
    console.error("Unable to verify organizer event publication readiness", await response.text());
    return { ok: false, message: "Unable to verify event publication readiness.", status: 502 };
  }

  const event = z.array(publicationEventSchema).parse(await response.json())[0] ?? null;
  if (!event) return { ok: false, message: "Event not found.", status: 404 };

  const requestedRace = (event.races ?? []).find((race) => race.id === raceId) ?? null;
  if (!requestedRace) return { ok: false, message: "Format introuvable pour cet événement.", status: 404 };
  const requestedEdition = (event.race_event_editions ?? []).find((edition) => edition.id === requestedRace.edition_id) ?? null;

  if (!event.name?.trim()) return { ok: false, message: "Ajoute un nom avant de demander la publication.", status: 409 };
  if (!event.location?.trim()) return { ok: false, message: "Ajoute un lieu avant de demander la publication.", status: 409 };
  if (!requestedEdition?.start_date) return { ok: false, message: "Ajoute une date de début à cette édition avant de demander la publication.", status: 409 };
  if (!requestedEdition.end_date) return { ok: false, message: "Ajoute une date de fin à cette édition avant de demander la publication.", status: 409 };
  if (
    !requestedRace.name?.trim() ||
    !Number.isFinite(requestedRace.distance_km) ||
    requestedRace.distance_km <= 0 ||
    !Number.isFinite(requestedRace.elevation_gain_m) ||
    requestedRace.elevation_gain_m < 0
  ) {
    return { ok: false, message: "Complète le nom, la distance et le D+ de ce format avant de demander sa publication.", status: 409 };
  }

  return { ok: true, publishableRaceCount: 1, raceId: requestedRace.id };
}
