import { z } from "zod";

import { parseOrganizerEventDetails } from "./organizer-dashboard-details";
import { serviceHeaders, type OrganizerAuth } from "./organizer";

const publicationEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
  races: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().nullable().optional(),
        distance_km: z.number(),
        elevation_gain_m: z.number(),
      })
    )
    .nullable()
    .optional(),
});

export type PublicationReadiness =
  | { ok: true; publishableRaceCount: number }
  | { ok: false; message: string; status: number };

export async function validateOrganizerEventPublication(
  serviceConfig: OrganizerAuth["serviceConfig"],
  eventId: string
): Promise<PublicationReadiness> {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}&select=id,name,location,race_date,organizer_details,races(id,name,distance_km,elevation_gain_m)&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  );

  if (!response.ok) {
    console.error("Unable to verify organizer event publication readiness", await response.text());
    return { ok: false, message: "Unable to verify event publication readiness.", status: 502 };
  }

  const event = z.array(publicationEventSchema).parse(await response.json())[0] ?? null;
  if (!event) return { ok: false, message: "Event not found.", status: 404 };

  const eventDetails = parseOrganizerEventDetails(event.organizer_details);
  const publishableRaceCount = (event.races ?? []).filter(
    (race) =>
      Boolean(race.name?.trim()) &&
      Number.isFinite(race.distance_km) &&
      race.distance_km > 0 &&
      Number.isFinite(race.elevation_gain_m) &&
      race.elevation_gain_m >= 0
  ).length;

  if (!event.name?.trim()) return { ok: false, message: "Ajoute un nom avant de demander la publication.", status: 409 };
  if (!event.location?.trim()) return { ok: false, message: "Ajoute un lieu avant de demander la publication.", status: 409 };
  if (!event.race_date?.trim()) return { ok: false, message: "Ajoute une date de debut avant de demander la publication.", status: 409 };
  if (!eventDetails.dateRange.endDate?.trim()) {
    return { ok: false, message: "Ajoute une date de fin avant de demander la publication.", status: 409 };
  }
  if (publishableRaceCount === 0) {
    return { ok: false, message: "Ajoute au moins un format complet avant de demander la publication.", status: 409 };
  }

  return { ok: true, publishableRaceCount };
}
