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
  gpx_storage_path: z.string().nullable().optional(),
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

/** Per race: finished background videos and saved narration (see /api/admin/video-generator/race-stats). */
export const videoRaceStatsSchema = z.object({
  races: z.record(z.string(), z.object({ videos: z.number(), narration: z.boolean(), voice: z.boolean() })),
});
export type VideoRaceStats = z.infer<typeof videoRaceStatsSchema>["races"];

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Events whose name contains every typed word, accents and case ignored ("sainte lyon" finds "SaintéLyon"). */
export const filterEventChoices = <T extends { name: string }>(choices: T[], query: string) => {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return choices;
  return choices.filter((choice) => {
    const name = normalize(choice.name);
    return words.every((word) => name.includes(word));
  });
};

export const countEventVideos = (catalog: VideoGeneratorCatalog, eventId: string, stats: VideoRaceStats) =>
  getRacesForEvent(catalog, eventId).reduce((sum, race) => sum + (stats[race.id]?.videos ?? 0), 0);

export const formatVideoCount = (count: number) => (count === 0 ? "aucune vidéo" : count === 1 ? "1 vidéo" : `${count} vidéos`);

/** "SaintéLyon 82 km · GPX · 2 vidéos · récit enregistré", or "· sans GPX". */
export const formatRaceChoiceLabel = (race: VideoGeneratorCatalogRace, stats: VideoRaceStats) => {
  const entry = stats[race.id];
  const parts = [
    race.name,
    race.gpx_storage_path ? "GPX" : "sans GPX",
    entry?.videos ? formatVideoCount(entry.videos) : null,
    entry?.narration ? (entry.voice ? "récit + voix enregistrés" : "récit enregistré") : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
};
