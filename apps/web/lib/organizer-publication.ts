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
        slug: z.string().nullable().optional(),
        race_date: z.string().nullable().optional(),
        location_text: z.string().nullable().optional(),
        source_url: z.string().nullable().optional(),
        external_site_url: z.string().nullable().optional(),
        distance_km: z.number(),
        elevation_gain_m: z.number().nullable(),
        data_status: z.enum(["draft", "complete"]).optional().default("complete"),
        missing_required_fields: z.array(z.string()).optional().default([]),
      })
    )
    .nullable()
    .optional(),
});

export type PublicationReadiness =
  | { ok: true; publishableRaceCount: number; raceId: string | null }
  | { ok: false; message: string; status: number };

const hasCatalogMinimum = (race: {
  name?: string | null;
  slug?: string | null;
  race_date?: string | null;
  location_text?: string | null;
  source_url?: string | null;
  external_site_url?: string | null;
  distance_km: number;
  data_status: "draft" | "complete";
  missing_required_fields: string[];
}) => Boolean(
  race.name?.trim() && race.slug?.trim() && race.race_date && race.location_text?.trim() &&
  (race.source_url?.trim() || race.external_site_url?.trim()) &&
  Number.isFinite(race.distance_km) && race.distance_km > 0 &&
  race.data_status === "complete" && race.missing_required_fields.length === 0
);

export async function validateOrganizerEventPublication(
  serviceConfig: OrganizerAuth["serviceConfig"],
  eventId: string,
  raceId?: string
): Promise<PublicationReadiness> {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}&select=id,name,location,race_event_editions(id,start_date,end_date,is_current),races(id,edition_id,name,slug,race_date,location_text,source_url,external_site_url,distance_km,elevation_gain_m,data_status,missing_required_fields)&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  );

  if (!response.ok) {
    console.error("Unable to verify organizer event publication readiness", await response.text());
    return { ok: false, message: "Unable to verify event publication readiness.", status: 502 };
  }

  const event = z.array(publicationEventSchema).parse(await response.json())[0] ?? null;
  if (!event) return { ok: false, message: "Event not found.", status: 404 };

  if (!event.name?.trim()) return { ok: false, message: "Ajoute un nom avant de publier cette édition.", status: 409 };
  if (!event.location?.trim()) return { ok: false, message: "Ajoute un lieu avant de publier cette édition.", status: 409 };

  if (!raceId) {
    const currentEdition = (event.race_event_editions ?? []).find((edition) => edition.is_current) ?? null;
    if (!currentEdition?.start_date) return { ok: false, message: "Ajoute une date de début à l’édition en cours avant de la publier.", status: 409 };
    if (!currentEdition.end_date) return { ok: false, message: "Ajoute une date de fin à l’édition en cours avant de la publier.", status: 409 };

    const publishableRaces = (event.races ?? []).filter(
      (race) =>
        race.edition_id === currentEdition.id &&
        hasCatalogMinimum(race)
    );
    if (publishableRaces.length === 0) {
      return { ok: false, message: "Complète au moins un format (nom, date, lieu, distance et source) avant de publier cette édition.", status: 409 };
    }

    return { ok: true, publishableRaceCount: publishableRaces.length, raceId: null };
  }

  const requestedRace = (event.races ?? []).find((race) => race.id === raceId) ?? null;
  if (!requestedRace) return { ok: false, message: "Format introuvable pour cet événement.", status: 404 };
  const requestedEdition = (event.race_event_editions ?? []).find((edition) => edition.id === requestedRace.edition_id) ?? null;

  if (!requestedEdition?.start_date) return { ok: false, message: "Ajoute une date de début à cette édition avant de la publier.", status: 409 };
  if (!requestedEdition.end_date) return { ok: false, message: "Ajoute une date de fin à cette édition avant de la publier.", status: 409 };
  if (
    !hasCatalogMinimum(requestedRace)
  ) {
    return { ok: false, message: "Complète le nom, la date, le lieu, la distance et la source de ce format avant de demander sa publication.", status: 409 };
  }

  return { ok: true, publishableRaceCount: 1, raceId: requestedRace.id };
}

export async function validateOrganizerEditionPublication(
  serviceConfig: OrganizerAuth["serviceConfig"],
  eventId: string,
  editionId: string
): Promise<PublicationReadiness> {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}&select=id,name,location,race_event_editions(id,start_date,end_date,is_current),races(id,edition_id,name,slug,race_date,location_text,source_url,external_site_url,distance_km,elevation_gain_m,data_status,missing_required_fields)&limit=1`,
    { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
  );
  if (!response.ok) {
    console.error("Unable to verify organizer edition publication readiness", await response.text());
    return { ok: false, message: "Unable to verify edition publication readiness.", status: 502 };
  }
  const event = z.array(publicationEventSchema).parse(await response.json())[0] ?? null;
  if (!event) return { ok: false, message: "Event not found.", status: 404 };
  if (!event.name?.trim()) return { ok: false, message: "Ajoute un nom avant de publier.", status: 409 };
  if (!event.location?.trim()) return { ok: false, message: "Ajoute un lieu avant de publier.", status: 409 };

  const edition = (event.race_event_editions ?? []).find((row) => row.id === editionId) ?? null;
  if (!edition) return { ok: false, message: "Édition introuvable pour cet événement.", status: 404 };
  if (!edition.start_date || !edition.end_date) {
    return { ok: false, message: "Complète les dates de l’édition avant de publier.", status: 409 };
  }
  const publishableRaces = (event.races ?? []).filter(
    (race) =>
      race.edition_id === editionId &&
      hasCatalogMinimum(race)
  );
  if (publishableRaces.length === 0) {
    return { ok: false, message: "Complète au moins un format (nom, date, lieu, distance et source) avant de publier.", status: 409 };
  }
  return { ok: true, publishableRaceCount: publishableRaces.length, raceId: null };
}
