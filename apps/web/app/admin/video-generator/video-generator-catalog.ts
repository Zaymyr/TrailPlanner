import { z } from "zod";

const eventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

const raceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  event_id: z.string().uuid().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number().nullable(),
  elevation_loss_m: z.number().nullable().optional(),
});

export const videoGeneratorCatalogSchema = z.object({
  events: z.array(eventSchema),
  races: z.array(raceSchema),
});

export type VideoGeneratorCatalog = z.infer<typeof videoGeneratorCatalogSchema>;
export type VideoGeneratorCatalogRace = VideoGeneratorCatalog["races"][number];

export const STANDALONE_EVENT_ID = "standalone";

export const getEventChoices = (catalog: VideoGeneratorCatalog) => {
  const choices = catalog.events.map((event) => ({ id: event.id, name: event.name }));
  if (catalog.races.some((race) => !race.event_id)) {
    choices.push({ id: STANDALONE_EVENT_ID, name: "Formats sans événement" });
  }
  return choices;
};

export const getRacesForEvent = (catalog: VideoGeneratorCatalog, eventId: string) =>
  catalog.races.filter((race) =>
    eventId === STANDALONE_EVENT_ID ? !race.event_id : race.event_id === eventId
  );
